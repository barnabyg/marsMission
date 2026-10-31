import type { Catalogue } from "../catalogue/catalogue";
import { carryOutSurvey, operateAssets } from "./assetsInService";
import { carryOutOngoingResearch } from "./ongoingResearch";
import {
  awardScienceMilestones,
  dayReached,
  type MilestoneAward,
  type TurnCurve,
} from "./scienceMilestones";
import {
  addDays,
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
  FirstLandingEntry,
  FundingThresholdEntry,
  MilestoneEntry,
  MissionAsset,
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

interface FundingOutcome {
  payouts: FundingThreshold[];
  entries: FundingThresholdEntry[];
}

/** What is landing, to start a sentence, such as "The rover". Always in the Catalogue's order, whatever order the Mission lists them. */
function whatLands(catalogue: Catalogue, assets: Asset[]): string {
  const kinds = catalogue.assets
    .filter((asset) => asset.landsAtSite && assets.includes(asset))
    .map(({ kind }) => `the ${kind}`);
  const named = new Intl.ListFormat("en").format(new Set(kinds));
  return named.charAt(0).toUpperCase() + named.slice(1);
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
  const filledIn = (text: string) =>
    text
      .replaceAll("{site}", landingSite?.name ?? "")
      .replaceAll("{lander}", whatLands(catalogue, assets));
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
            description: `${filledIn(event.failureDescription)} Lost with the Mission: ${lostNames.join(", ")}.${safe} It costs ${publicSupportLost} Public Support.`,
            outcome: "failure",
          }
        : {
            kind: "missionEvent",
            day: rules.dayOf(event),
            eventId: event.id,
            title: event.name,
            description: filledIn(event.description),
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
function awardArrivalMilestones(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  deliveredAssets: Asset[],
): MilestoneAward[] {
  const earnedBy = ({ trigger }: Milestone) =>
    deliveredAssets.filter((asset) => {
      if ("totalScience" in trigger) return false;
      return "assetLands" in trigger
        ? asset.landsAtSite === true
        : asset.kind === trigger.assetKindArrives;
    });
  return catalogue.milestones
    .filter(
      (milestone) =>
        !program.milestoneIds.includes(milestone.id) &&
        earnedBy(milestone).length > 0,
    )
    .map((milestone) => ({
      milestone,
      day: Math.min(...earnedBy(milestone).map(rules.deliveryDay)),
    }));
}

function milestoneEntry({ milestone, day }: MilestoneAward): MilestoneEntry {
  return {
    kind: "milestone",
    day,
    milestoneId: milestone.id,
    title: milestone.name,
    description: `${milestone.description} It awards ${milestone.science} Science and ${milestone.publicSupport} Public Support.`,
  };
}

/** The Science for landing at a Landing Site for the first time, if something did. */
function creditFirstLanding(
  rules: Rules,
  program: Program,
  flown: MissionOutcome,
): { site: LandingSite; entry: FirstLandingEntry } | null {
  const landed = flown.deliveredAssets.find((asset) => asset.landsAtSite);
  const site = flown.landingSite;
  if (!landed || !site || program.landedSiteIds.includes(site.id)) return null;
  return {
    site,
    entry: {
      kind: "firstLanding",
      day: rules.deliveryDay(landed),
      title: `First landing at ${site.name}`,
      description: `${site.description} It earns ${site.science} Science.`,
    },
  };
}

/**
 * Pays each Funding Threshold that Public Support is at or above once the Turn's gains and losses are all in, for the
 * first time. It pays on the day Public Support reached that level for the last time in the Turn, so never before the
 * award that took it there, and a level lost again to a failed Mission doesn't count until it's regained.
 */
function payFundingThresholds(
  catalogue: Catalogue,
  program: Program,
  publicSupport: TurnCurve,
): FundingOutcome {
  const reached = catalogue.fundingThresholds.flatMap((threshold) => {
    const day = program.fundingThresholdsPaid.includes(threshold.publicSupport)
      ? null
      : dayReached(
          publicSupport,
          threshold.publicSupport,
          catalogue.program.launchWindowIntervalDays,
        );
    return day === null ? [] : [{ threshold, day }];
  });
  return {
    payouts: reached.map(({ threshold }) => threshold),
    entries: reached.map(({ threshold, day }): FundingThresholdEntry => ({
      kind: "fundingThreshold",
      day,
      title: `Funding Threshold reached: ${threshold.publicSupport} Public Support`,
      description: `The Program's backers pay out ${formatMoney(threshold.payoutMillions)}.`,
    })),
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
  const failedOnDay = flown.failedEvent ? rules.dayOf(flown.failedEvent) : null;
  const arrivalAwards = awardArrivalMilestones(
    catalogue,
    rules,
    program,
    flown.deliveredAssets,
  );
  const firstLanding = creditFirstLanding(rules, program, flown);
  const operated = operateAssets(catalogue, rules, program, plan, flown);
  const survey = carryOutSurvey(catalogue, rules, program, operated.inService);
  const research = carryOutOngoingResearch(
    catalogue,
    rules,
    operated.inService,
  );
  const scienceAwards = awardScienceMilestones(
    catalogue,
    program.milestoneIds,
    {
      start: program.science,
      lumps: [
        ...arrivalAwards.map(({ milestone, day }) => ({
          day,
          amount: milestone.science,
        })),
        ...(firstLanding
          ? [{ day: firstLanding.entry.day, amount: firstLanding.site.science }]
          : []),
      ],
      stints: research.stints.map(({ fromDay, toDay, science }) => ({
        fromDay,
        toDay,
        amount: science,
      })),
    },
  );
  const awards = [...arrivalAwards, ...scienceAwards];
  const scienceGained =
    sum(awards.map(({ milestone }) => milestone.science)) +
    (firstLanding ? firstLanding.site.science : 0) +
    research.science;
  const publicSupportGained =
    sum(awards.map(({ milestone }) => milestone.publicSupport)) +
    research.publicSupport;
  const publicSupportBeforeDrain =
    program.publicSupport - flown.publicSupportLost + publicSupportGained;
  const funding = payFundingThresholds(catalogue, program, {
    start: program.publicSupport,
    lumps: [
      ...awards.map(({ milestone, day }) => ({
        day,
        amount: milestone.publicSupport,
      })),
      ...(failedOnDay === null
        ? []
        : [{ day: failedOnDay, amount: -flown.publicSupportLost }]),
    ],
    stints: research.stints.map(({ fromDay, toDay, publicSupport }) => ({
      fromDay,
      toDay,
      amount: publicSupport,
    })),
  });
  const faded = fadePublicSupport(catalogue, publicSupportBeforeDrain);

  const moneyEndMillions =
    program.moneyMillions -
    costMillions +
    sum(funding.payouts.map(({ payoutMillions }) => payoutMillions)) +
    research.researchGrantMillions;
  const assetNames = flown.assets.map((asset) => asset.name);
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
      activityName: rules.activityNameOf(asset),
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
        ...awards.map(({ milestone }) => milestone.id),
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
      // The sort is stable, so an award stays after the arrival or the Science that earned it.
      entries: [
        ...flown.entries,
        ...arrivalAwards.map(milestoneEntry),
        ...(firstLanding ? [firstLanding.entry] : []),
        ...scienceAwards.map(milestoneEntry),
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
      publicSupportGained,
      publicSupportDrained: publicSupportBeforeDrain - faded.end,
      publicSupportEnd: faded.end,
      milestones: awards.map(
        ({ milestone: { name, science, publicSupport } }) => ({
          name,
          science,
          publicSupport,
        }),
      ),
      firstLanding: firstLanding && {
        siteName: firstLanding.site.name,
        science: firstLanding.site.science,
      },
      ongoingResearch: research.earned,
      assetsEnded: operated.inService
        .filter(({ untilDay, failed }) => untilDay !== null && !failed)
        .map(({ asset }) => asset.name),
      assetsFailed: operated.inService
        .filter(({ failed }) => failed)
        .map(({ asset }) => asset.name),
      survey: survey.summary,
      fundingPayouts: funding.payouts,
      researchGrants: research.researchGrants,
      researchGrantMillions: research.researchGrantMillions,
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
