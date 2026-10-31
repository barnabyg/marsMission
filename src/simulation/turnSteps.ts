import type { Catalogue } from "../catalogue/catalogue";
import {
  addDays,
  daysUntilServiceEnds,
  formatMoney,
  roll,
  sum,
  type Asset,
  type LandingSite,
  type MissionEvent,
  type Rules,
} from "./rules";
import type {
  AssetAtMars,
  AssetEndedEntry,
  AssetFailedEntry,
  FirstLandingEntry,
  FundingThresholdEntry,
  MilestoneEntry,
  MissionAsset,
  SurveyEntry,
  MissionEventEntry,
  Program,
  TurnPlan,
  TurnResult,
} from "./types";

type Milestone = Catalogue["milestones"][number];
type FundingThreshold = Catalogue["fundingThresholds"][number];

/** What happened to the Turn's Mission, if there was one. */
interface MissionOutcome {
  vehicleName: string | null;
  assets: Asset[];
  /** The Mission Events that happened, ending with the one that failed if one did. */
  entries: MissionEventEntry[];
  failedEvent: MissionEvent | undefined;
  deliveredAssets: Asset[];
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
}

interface MilestoneAwards {
  awarded: Milestone[];
  entries: MilestoneEntry[];
  science: number;
  publicSupport: number;
}

interface FundingOutcome {
  payouts: FundingThreshold[];
  entries: FundingThresholdEntry[];
}

/** Rolls each of the Mission's Mission Events in turn, up to the first that fails. */
function flyMission(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): MissionOutcome {
  const { mission } = plan;
  const vehicle = catalogue.launchVehicles.find(
    (candidate) => candidate.id === mission?.launchVehicleId,
  );
  const assets = (mission?.assetIds ?? []).flatMap((assetId) =>
    catalogue.assets.filter((candidate) => candidate.id === assetId),
  );
  const landingSite = rules.landingSiteById(mission?.landingSiteId);
  const withSite = (text: string) =>
    text.replaceAll("{site}", landingSite?.name ?? "");
  const plannedEvents = mission
    ? rules.missionEventsFor(mission.launchVehicleId, mission.assetIds)
    : [];
  const failedIndex = plannedEvents.findIndex(
    (event) =>
      roll(program.seed, program.turnNumber, event.id) <
      rules.failureProbability(
        event,
        rules.reliabilityLevelFor(mission, event.id),
        program,
        mission,
      ),
  );
  const failedEvent = plannedEvents[failedIndex];
  // An Asset is delivered when its last Mission Event succeeds, so anything delivered before a failure is safe.
  const deliveredAssets = failedEvent
    ? assets.filter(
        (asset) => rules.deliveryDay(asset) < rules.dayOf(failedEvent),
      )
    : assets;
  const lostNames = assets
    .filter((asset) => !deliveredAssets.includes(asset))
    .map((asset) => asset.name);
  const safe =
    deliveredAssets.length > 0
      ? ` Still safe: ${deliveredAssets.map((asset) => asset.name).join(", ")}.`
      : "";
  const publicSupportLost = failedEvent
    ? Math.min(failedEvent.publicSupportLoss, program.publicSupport)
    : 0;

  const entries = plannedEvents
    .slice(0, failedEvent ? failedIndex + 1 : undefined)
    .map((event): MissionEventEntry =>
      event === failedEvent
        ? {
            kind: "missionEvent",
            day: rules.dayOf(event),
            eventId: event.id,
            title: `${event.name} failed`,
            description: `${withSite(event.failureDescription)} Lost with the Mission: ${lostNames.join(", ")}.${safe} It costs ${publicSupportLost} Public Support.`,
            outcome: "failure",
          }
        : {
            kind: "missionEvent",
            day: rules.dayOf(event),
            eventId: event.id,
            title: event.name,
            description: withSite(event.description),
            outcome: "success",
          },
    );

  return {
    vehicleName: vehicle?.name ?? null,
    assets,
    entries,
    failedEvent,
    deliveredAssets,
    publicSupportLost,
    landingSite,
  };
}

/** Awards each Milestone that an Asset delivered this Turn has earned for the first time. */
function awardMilestones(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  deliveredAssets: Asset[],
): MilestoneAwards {
  const arrivingKinds = deliveredAssets.map((asset) => asset.kind);
  const dayEarned = ({ trigger }: Milestone) =>
    Math.min(
      ...deliveredAssets
        .filter((asset) => asset.kind === trigger.assetKindArrives)
        .map(rules.deliveryDay),
    );
  const awarded = catalogue.milestones.filter(
    ({ id, trigger }) =>
      !program.milestoneIds.includes(id) &&
      arrivingKinds.includes(trigger.assetKindArrives),
  );
  return {
    awarded,
    entries: awarded.map((milestone): MilestoneEntry => ({
      kind: "milestone",
      day: dayEarned(milestone),
      milestoneId: milestone.id,
      title: milestone.name,
      description: `${milestone.description} It awards ${milestone.science} Science and ${milestone.publicSupport} Public Support.`,
    })),
    science: sum(awarded.map(({ science }) => science)),
    publicSupport: sum(awarded.map(({ publicSupport }) => publicSupport)),
  };
}

/** The Science for landing at a Landing Site for the first time, if a lander did. */
function creditFirstLanding(
  rules: Rules,
  program: Program,
  flown: MissionOutcome,
): { site: LandingSite; entry: FirstLandingEntry } | null {
  const lander = flown.deliveredAssets.find((asset) => asset.landsAtSite);
  const site = flown.landingSite;
  if (!lander || !site || program.landedSiteIds.includes(site.id)) return null;
  return {
    site,
    entry: {
      kind: "firstLanding",
      day: rules.deliveryDay(lander),
      title: `First landing at ${site.name}`,
      description: `${site.description} It earns ${site.science} Science.`,
    },
  };
}

/** One Asset's time at Mars during this Turn. */
interface AssetInService {
  asset: Program["operatingAssets"][number];
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
  /** The day of the Turn it stops, or null if it lasts beyond the Turn. */
  untilDay: number | null;
  /** Whether it stopped by failing, rather than its Service Life ending. */
  failed: boolean;
}

/**
 * The day an already operating Asset fails this Turn, if it does. Each roll depends only on the seed,
 * the Turn and this Asset, and the day comes before `limitDay`, when its time in this Turn ends anyway.
 */
function inServiceFailureDay(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  asset: Program["operatingAssets"][number],
  limitDay: number,
): number | null {
  const design = catalogue.assets.find(({ id }) => id === asset.assetId);
  const level = catalogue.reliabilityLevels.find(
    ({ id }) => id === asset.reliabilityLevelId,
  );
  // An Asset with no time left in this Turn has nothing to fail in.
  if (!design || !level || limitDay <= 1) return null;
  const key = `in-service:${asset.assetId}:${asset.arrivedOn}`;
  const chance = rules.inServiceFailureChance(design, level);
  if (roll(program.seed, program.turnNumber, key) >= chance) return null;
  const dayRoll = roll(program.seed, program.turnNumber, `${key}:day`);
  return 1 + Math.floor(dayRoll * (limitDay - 1));
}

/** Works out when each Asset at Mars stops operating this Turn, because its Service Life has ended or it has failed. */
function operateAssets(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: MissionOutcome,
): {
  inService: AssetInService[];
  entries: (AssetEndedEntry | AssetFailedEntry)[];
} {
  const { launchWindowIntervalDays } = catalogue.program;
  const delivered = flown.deliveredAssets.map((asset) => ({
    asset: {
      assetId: asset.id,
      name: asset.name,
      kind: asset.kind,
      arrivedOn: addDays(program.date, rules.deliveryDay(asset)),
      landingSiteId: asset.landsAtSite ? (flown.landingSite?.id ?? null) : null,
      serviceLifeDays: rules.serviceLifeFor(plan.mission, asset).days,
      reliabilityLevelId: rules.assetReliabilityFor(plan.mission, asset).id,
    },
    fromDay: rules.deliveryDay(asset),
  }));
  const inService = [
    ...program.operatingAssets.map((asset) => ({ asset, fromDay: 0 })),
    ...delivered,
  ].map(({ asset, fromDay }): AssetInService => {
    const endDay = daysUntilServiceEnds(program.date, asset);
    // An upgraded save can hold an Asset whose Service Life has already passed. It ends as the Turn starts.
    const untilDay =
      endDay < launchWindowIntervalDays ? Math.max(endDay, 0) : null;
    // An Asset can't fail in the Turn it arrives.
    const failureDay =
      fromDay === 0
        ? inServiceFailureDay(
            catalogue,
            rules,
            program,
            asset,
            untilDay ?? launchWindowIntervalDays,
          )
        : null;
    return failureDay === null
      ? { asset, fromDay, untilDay, failed: false }
      : { asset, fromDay, untilDay: failureDay, failed: true };
  });
  return {
    inService,
    entries: inService.flatMap(
      ({ asset, untilDay, failed }): (AssetEndedEntry | AssetFailedEntry)[] => {
        if (untilDay === null) return [];
        const site = rules.landingSiteById(asset.landingSiteId)?.name;
        const place = site ? `at ${site}` : "at Mars";
        if (failed) {
          const entry: AssetFailedEntry = {
            kind: "assetFailed",
            day: untilDay,
            title: `${asset.name} failed`,
            description: `${asset.name} has broken down and stopped operating ${place}. It costs no Public Support.`,
          };
          return [entry];
        }
        const entry: AssetEndedEntry = {
          kind: "assetEnded",
          day: untilDay,
          title: `${asset.name}: Service Life ended`,
          description: `${asset.name} has stopped operating ${place}. It costs no Public Support.`,
        };
        return [entry];
      },
    ),
  };
}

/**
 * Carries out the Turn's Survey, if a surveying Asset operates at Mars during it. Every known site
 * drops to its surveyed risk in one step, and the next site in the catalogue becomes known.
 */
function carryOutSurvey(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  inService: AssetInService[],
) {
  // An Asset counts if it operated at any point in the Turn, however briefly.
  const surveyDays = inService
    .filter(
      ({ asset, fromDay, untilDay }) =>
        catalogue.assets.some(
          ({ id, surveys }) => id === asset.assetId && surveys,
        ) &&
        (untilDay === null || untilDay > fromDay),
    )
    .map(({ fromDay }) => fromDay);
  const unchanged = {
    knownLandingSiteIds: program.knownLandingSiteIds,
    surveyedLandingSiteIds: program.surveyedLandingSiteIds,
    entry: null,
    summary: null,
  };
  if (surveyDays.length === 0) return unchanged;

  const newlySurveyed = program.knownLandingSiteIds.filter(
    (id) => !program.surveyedLandingSiteIds.includes(id),
  );
  const revealed = catalogue.landingSites.find(
    (site) => !program.knownLandingSiteIds.includes(site.id),
  );
  if (newlySurveyed.length === 0 && !revealed) return unchanged;

  const knownLandingSiteIds = [
    ...program.knownLandingSiteIds,
    ...(revealed ? [revealed.id] : []),
  ];
  const namesSurveyed = newlySurveyed.flatMap(
    (id) => rules.landingSiteById(id)?.name ?? [],
  );
  const findings = [
    ...(namesSurveyed.length > 0
      ? [`Lower landing risk at ${namesSurveyed.join(", ")}.`]
      : []),
    ...(revealed ? [`A new Landing Site is known: ${revealed.name}.`] : []),
  ];
  const entry: SurveyEntry = {
    kind: "survey",
    day: Math.min(...surveyDays),
    title: "Survey from orbit",
    description: findings.join(" "),
  };
  return {
    knownLandingSiteIds,
    surveyedLandingSiteIds: knownLandingSiteIds,
    entry,
    summary: {
      siteNamesSurveyed: namesSurveyed,
      siteNameRevealed: revealed?.name ?? null,
    },
  };
}

/** Pays each Funding Threshold reached for the first time, on the day of the last award that could have reached it. */
function payFundingThresholds(
  catalogue: Catalogue,
  program: Program,
  publicSupport: number,
  awards: MilestoneEntry[],
): FundingOutcome {
  const day = Math.max(
    catalogue.program.transferDays,
    ...awards.map((award) => award.day),
  );
  const payouts = catalogue.fundingThresholds.filter(
    (threshold) =>
      threshold.publicSupport <= publicSupport &&
      !program.fundingThresholdsPaid.includes(threshold.publicSupport),
  );
  return {
    payouts,
    entries: payouts.map(
      ({ publicSupport: level, payoutMillions }): FundingThresholdEntry => ({
        kind: "fundingThreshold",
        day,
        title: `Funding Threshold reached: ${level} Public Support`,
        description: `The Program's backers pay out ${formatMoney(payoutMillions)}.`,
      }),
    ),
  };
}

/** Public Support at the end of the Turn, and why that cancels the Program if it does. */
function fadePublicSupport(catalogue: Catalogue, publicSupport: number) {
  const { publicSupportDrainPercent, cancellationLevel } = catalogue.program;
  // Public Support is whole points. Rounding down means it always falls, where rounding to the nearest point could stick at a low value.
  const end = Math.floor(
    (publicSupport * (100 - publicSupportDrainPercent)) / 100,
  );
  return {
    end,
    cancellationReason:
      end < cancellationLevel
        ? `Public Support fell to ${end}, below the Cancellation Level of ${cancellationLevel}.`
        : null,
  };
}

/** Works out a whole Turn from a plan that has already passed validation. */
export function resolveTurn(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  costMillions: number,
): TurnResult {
  const { launchWindowIntervalDays, transferDays } = catalogue.program;

  const flown = flyMission(catalogue, rules, program, plan);
  const milestones = awardMilestones(
    catalogue,
    rules,
    program,
    flown.deliveredAssets,
  );
  const firstLanding = creditFirstLanding(rules, program, flown);
  const operated = operateAssets(catalogue, rules, program, plan, flown);
  const survey = carryOutSurvey(catalogue, rules, program, operated.inService);
  const scienceGained =
    milestones.science + (firstLanding ? firstLanding.site.science : 0);
  const publicSupportBeforeDrain =
    program.publicSupport - flown.publicSupportLost + milestones.publicSupport;
  const funding = payFundingThresholds(
    catalogue,
    program,
    publicSupportBeforeDrain,
    milestones.entries,
  );
  const faded = fadePublicSupport(catalogue, publicSupportBeforeDrain);

  const moneyEndMillions =
    program.moneyMillions -
    costMillions +
    sum(funding.payouts.map(({ payoutMillions }) => payoutMillions));
  const assetNames = flown.assets.map((asset) => asset.name);
  const failedOnDay = flown.failedEvent ? rules.dayOf(flown.failedEvent) : null;
  const siteNameOf = (asset: Asset) =>
    asset.landsAtSite ? (flown.landingSite?.name ?? null) : null;
  const missionAssets = flown.assets.map((asset): MissionAsset => {
    const delivered = flown.deliveredAssets.includes(asset);
    return {
      name: asset.name,
      landingSiteName: siteNameOf(asset),
      deliveredOnDay: delivered ? rules.deliveryDay(asset) : null,
      lostOnDay: delivered ? null : failedOnDay,
      crashed:
        !delivered &&
        asset.landsAtSite === true &&
        flown.failedEvent !== undefined &&
        asset.missionEvents.includes(flown.failedEvent.id),
    };
  });
  const assetsAtMars = operated.inService.map(
    ({ asset, fromDay, untilDay }): AssetAtMars => ({
      name: asset.name,
      kind: asset.kind,
      landingSiteName: rules.landingSiteById(asset.landingSiteId)?.name ?? null,
      fromDay,
      untilDay,
    }),
  );

  return {
    program: {
      ...program,
      turnNumber: program.turnNumber + 1,
      date: addDays(program.date, launchWindowIntervalDays),
      moneyMillions: moneyEndMillions,
      publicSupport: faded.end,
      science: program.science + scienceGained,
      milestoneIds: [
        ...program.milestoneIds,
        ...milestones.awarded.map(({ id }) => id),
      ],
      knownLandingSiteIds: survey.knownLandingSiteIds,
      surveyedLandingSiteIds: survey.surveyedLandingSiteIds,
      landedSiteIds: firstLanding
        ? [...program.landedSiteIds, firstLanding.site.id]
        : program.landedSiteIds,
      fundingThresholdsPaid: [
        ...program.fundingThresholdsPaid,
        ...funding.payouts.map(({ publicSupport }) => publicSupport),
      ],
      operatingAssets: operated.inService
        .filter(({ untilDay }) => untilDay === null)
        .map(({ asset }) => asset),
      status:
        faded.cancellationReason === null
          ? program.status
          : { kind: "cancelled", reason: faded.cancellationReason },
    },
    timeline: {
      startDate: program.date,
      durationDays: launchWindowIntervalDays,
      mission:
        flown.vehicleName !== null
          ? {
              launchDay: 0,
              arrivalDay: transferDays,
              launchVehicleName: flown.vehicleName,
              assetNames,
              assets: missionAssets,
              failedOnDay,
            }
          : null,
      landingSites: catalogue.landingSites.map(
        ({ name, latitude, longitude }) => ({ name, latitude, longitude }),
      ),
      assetsAtMars,
      // The sort is stable, so an award stays after the arrival that earned it.
      entries: [
        ...flown.entries,
        ...milestones.entries,
        ...(firstLanding ? [firstLanding.entry] : []),
        ...(survey.entry ? [survey.entry] : []),
        ...operated.entries,
        ...funding.entries,
      ].sort((first, second) => first.day - second.day),
    },
    summary: {
      missionCostMillions: costMillions,
      moneyStartMillions: program.moneyMillions,
      moneyEndMillions,
      scienceGained,
      publicSupportStart: program.publicSupport,
      publicSupportGained: milestones.publicSupport,
      publicSupportDrained: publicSupportBeforeDrain - faded.end,
      publicSupportEnd: faded.end,
      milestones: milestones.awarded.map(
        ({ name, science, publicSupport }) => ({
          name,
          science,
          publicSupport,
        }),
      ),
      firstLanding: firstLanding && {
        siteName: firstLanding.site.name,
        science: firstLanding.site.science,
      },
      assetsEnded: operated.inService
        .filter(({ untilDay, failed }) => untilDay !== null && !failed)
        .map(({ asset }) => asset.name),
      assetsFailed: operated.inService
        .filter(({ failed }) => failed)
        .map(({ asset }) => asset.name),
      survey: survey.summary,
      fundingPayouts: funding.payouts,
      failure: flown.failedEvent
        ? {
            missionEventName: flown.failedEvent.name,
            assetsLost: flown.assets
              .filter((asset) => !flown.deliveredAssets.includes(asset))
              .map((asset) => asset.name),
            publicSupportLost: flown.publicSupportLost,
          }
        : null,
      cancellationReason: faded.cancellationReason,
    },
  };
}
