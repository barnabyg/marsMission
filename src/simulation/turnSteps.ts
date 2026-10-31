import type { Catalogue } from "../catalogue/catalogue";
import {
  addDays,
  formatMoney,
  missionEventRoll,
  sum,
  type Asset,
  type LandingSite,
  type MissionEvent,
  type Rules,
} from "./rules";
import type {
  AssetAtMars,
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
      missionEventRoll(program.seed, program.turnNumber, event.id) <
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

/**
 * Carries out the Turn's Survey, if a surveying Asset operates at Mars during it. Every known site
 * drops to its surveyed risk in one step, and the next site in the catalogue becomes known.
 */
function carryOutSurvey(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  flown: MissionOutcome,
) {
  const surveying = (assetId: string) =>
    catalogue.assets.some((asset) => asset.id === assetId && asset.surveys);
  const alreadyOperating = program.operatingAssets.some(({ assetId }) =>
    surveying(assetId),
  );
  const arrivalDays = flown.deliveredAssets
    .filter((asset) => asset.surveys)
    .map(rules.deliveryDay);
  const unchanged = {
    knownLandingSiteIds: program.knownLandingSiteIds,
    surveyedLandingSiteIds: program.surveyedLandingSiteIds,
    entry: null,
    summary: null,
  };
  if (!alreadyOperating && arrivalDays.length === 0) return unchanged;

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
  const namesSurveyed = newlySurveyed.flatMap((id) =>
    catalogue.landingSites
      .filter((site) => site.id === id)
      .map(({ name }) => name),
  );
  const findings = [
    ...(namesSurveyed.length > 0
      ? [`Lower landing risk at ${namesSurveyed.join(", ")}.`]
      : []),
    ...(revealed ? [`A new Landing Site is known: ${revealed.name}.`] : []),
  ];
  const entry: SurveyEntry = {
    kind: "survey",
    day: alreadyOperating ? 0 : Math.min(...arrivalDays),
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
  const survey = carryOutSurvey(catalogue, rules, program, flown);
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
  const assetsAtMars: AssetAtMars[] = [
    ...program.operatingAssets.map((asset) => ({
      name: asset.name,
      kind: asset.kind,
      landingSiteName: rules.landingSiteById(asset.landingSiteId)?.name ?? null,
      fromDay: 0,
    })),
    ...flown.deliveredAssets.map((asset) => ({
      name: asset.name,
      kind: asset.kind,
      landingSiteName: siteNameOf(asset),
      fromDay: rules.deliveryDay(asset),
    })),
  ];

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
      operatingAssets: [
        ...program.operatingAssets,
        ...flown.deliveredAssets.map((asset) => ({
          assetId: asset.id,
          name: asset.name,
          kind: asset.kind,
          arrivedOn: addDays(program.date, rules.deliveryDay(asset)),
          landingSiteId: asset.landsAtSite
            ? (flown.landingSite?.id ?? null)
            : null,
        })),
      ],
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
      assetsAtMars,
      // The sort is stable, so an award stays after the arrival that earned it.
      entries: [
        ...flown.entries,
        ...milestones.entries,
        ...(firstLanding ? [firstLanding.entry] : []),
        ...(survey.entry ? [survey.entry] : []),
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
