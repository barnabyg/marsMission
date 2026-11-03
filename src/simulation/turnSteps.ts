import type { Catalogue } from "../catalogue/catalogue";
import {
  carryOutSurvey,
  operateAssets,
  stoppedEntries,
} from "./assetsInService";
import {
  crewArrivedEntry,
  crewAtMars,
  crewShipsAtMars,
  crewSummary,
} from "./crewAtMars";
import { carryOutDevelopment } from "./development";
import { bringCrewHome, loseCrew, withCrew } from "./lostCrew";
import { resolveDustStorms } from "./dustStorms";
import type { MissionOutcome } from "./flight";
import { deliveryDayOf } from "./flyMission";
import { proveTechnologies } from "./flightProven";
import {
  contingenciesAnswered,
  missionFailure,
  missionOnTimeline,
} from "./missionReport";
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
  type LandingSite,
  type Rules,
} from "./rules";
import type { DecisionAnswers, Program, TurnPlan, TurnResult } from "./types";
import type {
  AssetAtMars,
  FirstLandingEntry,
  FundingThresholdEntry,
  MilestoneEntry,
  TimelineEntry,
} from "./timeline";

type Milestone = Catalogue["milestones"][number];
type FundingThreshold = Catalogue["fundingThresholds"][number];

interface FundingOutcome {
  payouts: FundingThreshold[];
  entries: FundingThresholdEntry[];
}

/** Awards each Milestone that an Asset or the Crew delivered this Turn have earned for the first time. */
function awardArrivalMilestones(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: MissionOutcome,
): MilestoneAward[] {
  const { deliveredAssets, deliveredCrew } = flown;
  /** The days on which what the Mission delivered earned it. */
  const earnedOn = ({ trigger }: Milestone): number[] => {
    if ("totalScience" in trigger) return [];
    if ("crewArrives" in trigger) {
      return deliveredCrew.length > 0
        ? [rules.deliveryDay(catalogue.crew, plan.mission)]
        : [];
    }
    return deliveredAssets
      .filter((asset) =>
        "assetLands" in trigger
          ? asset.landsAtSite === true
          : asset.kind === trigger.assetKindArrives,
      )
      .map((asset) => deliveryDayOf(rules, plan, flown, asset));
  };
  return catalogue.milestones
    .filter(
      (milestone) =>
        !program.milestoneIds.includes(milestone.id) &&
        earnedOn(milestone).length > 0,
    )
    .map((milestone) => ({ milestone, day: Math.min(...earnedOn(milestone)) }));
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
      day: deliveryDayOf(rules, plan, flown, landed),
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

/**
 * Works out a whole Turn from a plan that has already passed validation, how its Mission flew and the answers so far.
 * It also gives what happened apart from the Mission, and the earliest dust storm with no answer, which counts as sheltering.
 */
export function resolveTurn(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  costMillions: number,
  flown: MissionOutcome,
  answers: DecisionAnswers,
): {
  result: TurnResult;
  otherEntries: TimelineEntry[];
  stormDecision: ReturnType<typeof resolveDustStorms>["decision"];
} {
  const { launchWindowIntervalDays } = catalogue.program;

  const { failedOnDay } = flown;
  const arrivalAwards = awardArrivalMilestones(
    catalogue,
    rules,
    program,
    plan,
    flown,
  );
  const firstLanding = creditFirstLanding(rules, program, plan, flown);
  const proven = proveTechnologies(catalogue, rules, program, plan, flown);
  const development = carryOutDevelopment(catalogue, program, plan);
  const dustStorms = resolveDustStorms(
    catalogue,
    rules,
    program,
    operateAssets(catalogue, rules, program, plan, flown),
    answers,
  );
  const { inService } = dustStorms;
  const survey = carryOutSurvey(catalogue, rules, program, inService);
  const crew = crewAtMars(catalogue, rules, program, plan, flown);
  const lostCrew = loseCrew(
    catalogue,
    program,
    flown.crewLost,
    program.publicSupport - flown.publicSupportLost,
  );
  const crewHome = flown.returned?.crew ?? [];
  const research = carryOutOngoingResearch(
    catalogue,
    rules,
    inService,
    crew.atWork,
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
    program.publicSupport -
    flown.publicSupportLost -
    lostCrew.publicSupportLost +
    publicSupportGained;
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
      ...lostCrew.lumps,
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
    costMillions -
    development.costMillions +
    sum(funding.payouts.map(({ payoutMillions }) => payoutMillions)) +
    research.researchGrantMillions +
    (flown.returned?.refundMillions ?? 0);
  const cutServiceLife = new Map(
    [...flown.cutServiceLife].map(([asset, days]) => [asset.id, days]),
  );
  const assetsAtMars = inService.map(
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

  const otherEntries = [
    ...crewArrivedEntry(
      catalogue,
      rules,
      plan,
      crew.arrived,
      crew.crewActivities,
    ),
    ...lostCrew.entries,
    ...arrivalAwards.map(milestoneEntry),
    ...(firstLanding ? [firstLanding.entry] : []),
    ...proven.entries,
    ...scienceAwards.map(milestoneEntry),
    ...(survey.entry ? [survey.entry] : []),
    ...dustStorms.entries,
    ...stoppedEntries(rules, inService),
    ...funding.entries,
  ];

  const result: TurnResult = {
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
      provenTechnologyIds: [
        ...program.provenTechnologyIds,
        ...proven.technologies.map(({ id }) => id),
      ],
      developments: development.developments,
      operatingAssets: inService
        .filter(({ untilDay }) => untilDay === null)
        .map(({ asset }) => asset),
      crew: withCrew(program.crew, [
        ...crew.arrived,
        ...lostCrew.lost,
        ...(flown.returned
          ? bringCrewHome(
              catalogue,
              program,
              crewHome,
              flown.returned.backOnDay,
            )
          : []),
      ]),
      crewActivities: crew.crewActivities,
      status:
        faded.cancellationReason === null
          ? program.status
          : { kind: "cancelled", reason: faded.cancellationReason },
    },
    timeline: {
      startDate: program.date,
      durationDays: launchWindowIntervalDays,
      decisionDay: null,
      mission: missionOnTimeline(catalogue, rules, plan, flown),
      landingSites: catalogue.landingSites.map(
        ({ name, latitude, longitude }) => ({ name, latitude, longitude }),
      ),
      assetsAtMars: [
        ...assetsAtMars,
        ...crewShipsAtMars(catalogue, rules, program, crew.atWork),
      ],
      dustStorms: dustStorms.storms,
      // The sort is stable, so an award stays after the arrival or the Science that earned it.
      entries: [...flown.entries, ...otherEntries].sort(
        (first, second) => first.day - second.day,
      ),
    },
    summary: {
      missionCostMillions: costMillions,
      developmentCostMillions: development.costMillions,
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
      technologiesProven: proven.technologies.map(({ name }) => name),
      developmentsStarted: development.started,
      developmentsFinished: development.finished,
      crew: crewSummary(catalogue, crew.atWork),
      crewLost: lostCrew.summary,
      crewHome,
      assetsEnded: inService
        .filter(({ untilDay, failed }) => untilDay !== null && !failed)
        .map(({ asset }) => asset.name),
      assetsFailed: inService
        .filter(({ failed }) => failed)
        .map(({ asset }) => asset.name),
      dustStorms: dustStorms.summary,
      solarParticleEvent: flown.solarParticleEvent?.summary ?? null,
      goNoGo: flown.goNoGo,
      survey: survey.summary,
      fundingPayouts: funding.payouts,
      researchGrants: research.researchGrants,
      researchGrantMillions: research.researchGrantMillions,
      failure: missionFailure(flown),
      contingencies: contingenciesAnswered(flown),
      cancellationReason: faded.cancellationReason,
    },
  };
  return { result, otherEntries, stormDecision: dustStorms.decision };
}
