import type { Catalogue } from "../catalogue/catalogue";
import { carryOutSurvey, operateAssets } from "./assetsInService";
import {
  contingenciesAnswered,
  missionFailure,
  missionOnTimeline,
  type MissionOutcome,
} from "./missionFlight";
import { carryOutOngoingResearch } from "./ongoingResearch";
import {
  awardScienceMilestones,
  dayReached,
  type MilestoneAward,
  type TurnCurve,
} from "./scienceMilestones";
import {
  addDays,
  daysBetween,
  formatMoney,
  operatingKey,
  sum,
  type Asset,
  type LandingSite,
  type Rules,
} from "./rules";
import type {
  AssetAtMars,
  FirstLandingEntry,
  FundingThresholdEntry,
  MilestoneEntry,
  Program,
  TurnPlan,
  TurnResult,
} from "./types";

type Milestone = Catalogue["milestones"][number];
type FundingThreshold = Catalogue["fundingThresholds"][number];

interface FundingOutcome {
  payouts: FundingThreshold[];
  entries: FundingThresholdEntry[];
}

/** Awards each Milestone that an Asset delivered this Turn has earned for the first time. */
function awardArrivalMilestones(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
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
      day: Math.min(
        ...earnedBy(milestone).map((asset) =>
          rules.deliveryDay(asset, plan.mission),
        ),
      ),
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
  plan: TurnPlan,
  flown: MissionOutcome,
): { site: LandingSite; entry: FirstLandingEntry } | null {
  const landed = flown.deliveredAssets.find((asset) => asset.landsAtSite);
  const site = flown.landingSite;
  if (!landed || !site || program.landedSiteIds.includes(site.id)) return null;
  return {
    site,
    entry: {
      kind: "firstLanding",
      day: rules.deliveryDay(landed, plan.mission),
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

/** Works out a whole Turn from a plan that has already passed validation, and how its Mission flew. */
export function resolveTurn(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  costMillions: number,
  flown: MissionOutcome,
): TurnResult {
  const { launchWindowIntervalDays } = catalogue.program;

  const { failedOnDay } = flown;
  const arrivalAwards = awardArrivalMilestones(
    catalogue,
    rules,
    program,
    plan,
    flown.deliveredAssets,
  );
  const firstLanding = creditFirstLanding(rules, program, plan, flown);
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
    research.researchGrantMillions +
    (flown.returned?.refundMillions ?? 0);
  const cutServiceLife = new Map(
    [...flown.rescuedServiceLife].map(([asset, days]) => [asset.id, days]),
  );
  const assetsAtMars = operated.inService.map(
    ({ asset, fromDay, untilDay }): AssetAtMars => {
      const cutServiceLifeDays =
        fromDay > 0 ? cutServiceLife.get(asset.assetId) : undefined;
      return {
        key: operatingKey(asset),
        name: asset.name,
        kind: asset.kind,
        landingSiteName:
          rules.landingSiteById(asset.landingSiteId)?.name ?? null,
        activityName: rules.activityNameOf(asset),
        surfaceMotion: rules.surfaceMotionOf(asset),
        arrivedOnDay: daysBetween(program.date, asset.arrivedOn),
        fromDay,
        untilDay,
        ...(cutServiceLifeDays === undefined ? {} : { cutServiceLifeDays }),
      };
    },
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
      decisionDay: null,
      mission: missionOnTimeline(rules, plan, flown),
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
      failure: missionFailure(flown),
      contingencies: contingenciesAnswered(flown),
      cancellationReason: faded.cancellationReason,
    },
  };
}
