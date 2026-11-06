import {
  makeAscentPropellant,
  spendAscentPropellant,
} from "./ascentPropellant";
import { baseFundingFor } from "./baseFunding";
import type { Catalogue } from "../catalogue/catalogue";
import {
  assetsAtMarsOnTimeline,
  carryOutSurvey,
  operateAssets,
  stoppedEntries,
} from "./assetsInService";
import {
  awardArrivalMilestones,
  creditFirstLanding,
  milestoneEntry,
} from "./arrivals";
import {
  crewAtMars,
  crewAtTurnEnd,
  crewLeavingMars,
  rehoused,
} from "./crewAtMars";
import { welcomeCrewHome } from "./crewHome";
import {
  stageArriving,
  stageComingHome,
  stagesAfterTurn,
} from "./earthReturnStages";
import { journeyHomeDays } from "./homeward";
import { returnVehicleArriving, returnVehicleReport } from "./returnVehicles";
import { afterSamplesLeft, sendSamplesHome } from "./sampleReturn";
import { sampleJourneySummary, settleSamples } from "./samplesHome";
import { storeHabitatSupplies } from "./habitats";
import {
  flyJourneyHome,
  journeyHomeOnTimeline,
  type JourneyHome,
} from "./journeyHome";
import {
  crewArrivedEntry,
  crewShipsAtMars,
  crewSummary,
  healthLostSummary,
} from "./crewAtMarsReport";
import { carryOutDevelopment } from "./development";
import { bringCrewHome, loseCrew, withCrew } from "./lostCrew";
import { protectionIdOf } from "./protection";
import { resolveDustStorms } from "./dustStorms";
import type { MissionOutcome } from "./flight";
import { proveTechnologies } from "./flightProven";
import { suppliesRanOut } from "./supplies";
import {
  contingenciesAnswered,
  missionFailure,
  missionOnTimeline,
} from "./missionReport";
import { carryOutOngoingResearch } from "./ongoingResearch";
import { fadePublicSupport, payFundingThresholds } from "./fundingThresholds";
import { awardScienceMilestones } from "./scienceMilestones";
import { addDays, sum, type Rules } from "./rules";
import type { DecisionAnswers, Program, TurnPlan, TurnResult } from "./types";
import type { TimelineEntry } from "./timeline";

/**
 * Works out a whole Turn from a plan that has already passed validation, how its Mission flew and the answers so far.
 * It also gives what happened apart from the Mission, and the earliest dust storm with no answer, which counts as sheltering.
 */
export function resolveTurn(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  /** What the Mission cost, and what keeping the Assets at Mars going cost, which the plan has already been checked for. */
  {
    missionMillions: costMillions,
    upkeepMillions,
  }: { missionMillions: number; upkeepMillions: number },
  flown: MissionOutcome,
  answers: DecisionAnswers,
): {
  result: TurnResult;
  otherEntries: TimelineEntry[];
  stormDecision: ReturnType<typeof resolveDustStorms>["decision"];
  /** The Turn's journey home, of Crew or of samples, if one flew, which can stop at a Decision Point of its own. */
  journeyHome: Pick<JourneyHome, "outcome"> | null;
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
  const comingHome = stageComingHome(program, plan);
  const operating = operateAssets(catalogue, rules, program, plan, flown);
  const crewThere = crewAtMars(
    catalogue,
    rules,
    program,
    plan,
    flown,
    comingHome && {
      names: comingHome.names,
      leavesOn: journeyHomeDays(catalogue, rules).leavesOn,
    },
    operating,
  );
  const dustStorms = resolveDustStorms(
    catalogue,
    rules,
    program,
    operating,
    crewThere.atWork,
    answers,
  );
  const sampleJourney = sendSamplesHome(
    catalogue,
    rules,
    program,
    plan,
    dustStorms.inService,
    answers,
  );
  // An ascent vehicle and an Earth return orbiter that flew samples home leave Mars on the day each did.
  const inService = afterSamplesLeft(dustStorms.inService, sampleJourney);
  // A habitat lost in a dust storm houses its Crew no longer.
  const crewAtWork = rehoused(catalogue, dustStorms.crewAtWork, inService);
  const survey = carryOutSurvey(catalogue, rules, program, inService);
  const made = makeAscentPropellant(catalogue, rules, program, inService);
  const journey =
    comingHome &&
    flyJourneyHome(
      catalogue,
      rules,
      program,
      comingHome.stage,
      crewLeavingMars(crewAtWork),
      answers,
    );
  const homeward = journey?.outcome ?? sampleJourney?.outcome ?? null;
  const samples = settleSamples(catalogue, rules, program, inService, {
    crew: comingHome && journey && { from: comingHome.from, journey },
    robotic: sampleJourney,
  });
  const samplesHome = samples.welcome;
  const propellant = spendAscentPropellant(
    rules,
    made,
    journey?.propellantUsed ?? null,
  );
  const crew = crewAtTurnEnd(crewAtWork, crewThere.crewActivities);
  const fetching = returnVehicleArriving(rules, program, plan, flown);
  const stages = stagesAfterTurn(
    program,
    plan,
    [...stageArriving(rules, plan.mission, crewThere.arrived), ...fetching],
    crew.stillThere,
  );
  const fetched = returnVehicleReport(flown, fetching, stages);
  const habitatSupplies = storeHabitatSupplies(
    catalogue,
    program,
    inService,
    crewAtWork,
    crew.crewSupplies,
  );
  const suppliesOut = suppliesRanOut(
    catalogue,
    program,
    crewAtWork,
    flown,
    homeward,
  );
  // What failing on the way home costs comes out of what the Mission's failure left.
  const homewardLost = Math.min(
    homeward?.publicSupportLost ?? 0,
    program.publicSupport - flown.publicSupportLost,
  );
  const lostCrew = loseCrew(
    catalogue,
    program,
    [...flown.crewLost, ...crew.deaths, ...(homeward?.crewLost ?? [])],
    program.publicSupport - flown.publicSupportLost - homewardLost,
    protectionIdOf(catalogue, plan.mission),
  );
  const freeReturnHome = flown.returned?.crew ?? [];
  const journeyHomeCrew = homeward?.deliveredCrew ?? [];
  const crewHome = [...freeReturnHome, ...journeyHomeCrew];
  const welcome = welcomeCrewHome(catalogue, program, [
    ...(flown.returned
      ? [{ names: freeReturnHome, day: flown.returned.backOnDay }]
      : []),
    ...(journey ? [{ names: journeyHomeCrew, day: journey.homeOn }] : []),
  ]);
  const research = carryOutOngoingResearch(
    catalogue,
    rules,
    inService,
    crewAtWork,
  );
  const scienceAwards = awardScienceMilestones(
    catalogue,
    program.milestoneIds,
    {
      start: program.science,
      lumps: [
        ...[...arrivalAwards, ...welcome.awards, ...samplesHome.awards].map(
          ({ milestone, day }) => ({ day, amount: milestone.science }),
        ),
        ...samplesHome.lumps,
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
  const awards = [
    ...arrivalAwards,
    ...welcome.awards,
    ...samplesHome.awards,
    ...scienceAwards,
  ];
  const scienceGained =
    sum(awards.map(({ milestone }) => milestone.science)) +
    samplesHome.science +
    (firstLanding ? firstLanding.site.science : 0) +
    research.science;
  const publicSupportGained =
    sum(awards.map(({ milestone }) => milestone.publicSupport)) +
    research.publicSupport +
    welcome.publicSupport;
  const publicSupportBeforeDrain =
    program.publicSupport -
    flown.publicSupportLost -
    homewardLost -
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
      ...(homeward?.failedOnDay === undefined || homeward.failedOnDay === null
        ? []
        : [{ day: homeward.failedOnDay, amount: -homewardLost }]),
      ...lostCrew.lumps,
      ...welcome.lumps,
    ],
    stints: research.stints.map(({ fromDay, toDay, publicSupport }) => ({
      fromDay,
      toDay,
      amount: publicSupport,
    })),
  });
  const faded = fadePublicSupport(catalogue, publicSupportBeforeDrain);

  // Sized by Public Support as the Turn started, so that Planning Mode can say what it will be.
  const baseFundingMillions = baseFundingFor(catalogue, program.publicSupport);
  const moneyEndMillions =
    program.moneyMillions -
    costMillions -
    development.costMillions -
    upkeepMillions +
    sum(funding.payouts.map(({ payoutMillions }) => payoutMillions)) +
    research.researchGrantMillions +
    baseFundingMillions +
    (flown.returned?.refundMillions ?? 0);
  const assetsAtMars = assetsAtMarsOnTimeline(rules, program, inService, flown);

  const otherEntries = [
    ...fetched.entries,
    ...crewArrivedEntry(
      catalogue,
      rules,
      plan,
      flown,
      crewThere.arrived,
      crew.crewActivities,
    ),
    ...lostCrew.entries,
    ...welcome.entries,
    ...samplesHome.entries,
    ...(sampleJourney?.entries ?? []),
    ...suppliesOut.entries,
    ...arrivalAwards.map(milestoneEntry),
    ...welcome.awards.map(milestoneEntry),
    ...samplesHome.awards.map(milestoneEntry),
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
        ...crew.stillThere,
        ...lostCrew.lost,
        ...(flown.returned
          ? bringCrewHome(
              program,
              flown.crewHealth.filter(({ name }) =>
                freeReturnHome.includes(name),
              ),
              flown.returned.backOnDay,
              protectionIdOf(catalogue, plan.mission),
            )
          : []),
        ...(journey
          ? bringCrewHome(
              program,
              journey.outcome.crewHealth.filter(({ name }) =>
                journeyHomeCrew.includes(name),
              ),
              journey.homeOn,
              protectionIdOf(catalogue, plan.mission),
            )
          : []),
      ]),
      crewActivities: crew.crewActivities,
      crewSupplies: habitatSupplies.crewSupplies,
      earthReturnStages: stages,
      ascentPropellantKg: propellant.ascentPropellantKg,
      habitatSuppliesKg: habitatSupplies.habitatSuppliesKg,
      samplesAtSites: samples.samplesAtSites,
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
        ...crewShipsAtMars(catalogue, rules, program, crewAtWork),
      ],
      dustStorms: dustStorms.storms,
      journeyHome: journeyHomeOnTimeline(
        catalogue,
        rules,
        comingHome && journey && { from: comingHome.from, journey },
        sampleJourney,
      ),
      // The sort is stable, so an award stays after the arrival or the Science that earned it.
      entries: [
        ...flown.entries,
        ...(homeward?.entries ?? []),
        ...otherEntries,
      ].sort((first, second) => first.day - second.day),
    },
    summary: {
      missionCostMillions: costMillions,
      developmentCostMillions: development.costMillions,
      upkeepMillions,
      moneyStartMillions: program.moneyMillions,
      moneyEndMillions,
      scienceStart: program.science,
      scienceGained,
      publicSupportStart: program.publicSupport,
      publicSupportGained,
      publicSupportDrained: publicSupportBeforeDrain - faded.end,
      publicSupportEnd: faded.end,
      milestones: awards.map(
        ({ milestone: { name, description, science, publicSupport } }) => ({
          name,
          description,
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
      crew: crewSummary(catalogue, crewAtWork),
      crewLost: lostCrew.summary,
      healthLost: healthLostSummary(crewAtWork, flown, homeward),
      crewHome,
      publicSupportForCrewHome: welcome.publicSupport,
      returnVehicle: fetched.summary,
      journeyHome: journey && {
        crew: journey.crew,
        samples: samples.withCrew,
        samplesFrom: samples.takenWithCrew,
        failure: journey.outcome.failedEvent
          ? {
              missionEventName: journey.outcome.failedEvent.name,
              publicSupportLost: homewardLost,
            }
          : null,
      },
      samplesCached: samples.cached,
      samplesHome: samplesHome.summary,
      sampleJourney: sampleJourneySummary(sampleJourney, homewardLost),
      suppliesRanOut: suppliesOut.summary,
      assetsEnded: inService
        .filter(
          ({ untilDay, failed, leftForHome }) =>
            untilDay !== null && !failed && leftForHome !== true,
        )
        .map(({ asset }) => asset.name),
      assetsFailed: inService
        .filter(({ failed }) => failed)
        .map(({ asset }) => asset.name),
      dustStorms: dustStorms.summary,
      solarParticleEvent: flown.solarParticleEvent?.summary ?? null,
      goNoGo: flown.goNoGo,
      survey: survey.summary,
      ascentPropellant: propellant.made,
      ascentPropellantUsed: propellant.used,
      fundingPayouts: funding.payouts,
      researchGrants: research.researchGrants,
      researchGrantMillions: research.researchGrantMillions,
      baseFundingMillions,
      failure: missionFailure(flown),
      contingencies: [
        ...contingenciesAnswered(flown),
        ...(homeward ? contingenciesAnswered(homeward) : []),
      ],
      cancellationReason: faded.cancellationReason,
    },
  };
  return {
    result,
    otherEntries,
    stormDecision: dustStorms.decision,
    journeyHome: journey ?? sampleJourney,
  };
}
