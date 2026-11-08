import {
  technologiesOn,
  type CrewLossCause,
  type DecisionAnswer,
  type DecisionAnswers,
  type DecisionPoint,
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
  type TurnResult,
  type TurnSummary,
} from "../simulation/simulation";
import { crewProblems } from "./invalidCrew";
import { fetchingProblems } from "./invalidFetching";
import { habitatProblems } from "./invalidHabitats";
import { homecomingProblems } from "./invalidHomecomings";
import { labProblems } from "./invalidLabs";
import { propellantProblems } from "./invalidPropellant";
import { sampleProblems } from "./invalidSamples";
import { invalidStates, timelineMissionEventProblems } from "./invalidStates";
import type { PlanningTools, Strategy } from "./strategy";

/** What a report needs from one Turn of one Program. */
export interface TurnRecord {
  /** The Program at the end of the Turn. */
  moneyMillions: number;
  science: number;
  publicSupport: number;
  assetsOperating: number;
  cancelled: boolean;
  /** From the Turn's summary. What its Mission, any Development and the upkeep of the Assets at Mars cost. */
  spentMillions: number;
  thresholdMillions: number;
  researchGrantMillions: number;
  thresholdsReached: number[];
  researchScience: { activityName: string; science: number }[];
  /** The part of that Science that other Assets' Benefits added. */
  benefitScience: number;
  assetsFailed: number;
  launched: boolean;
  missionFailed: boolean;
  /** How many Decision Points came up, and how many Contingencies ended with the Assets saved. */
  decisionPoints: number;
  rescues: number;
  /** Each Decision Point answered, by kind, with a solar particle event with Crew aboard a kind of its own. */
  decisions: {
    kind: DecisionPoint["kind"] | "crewedSolarParticleEvent";
    answer: DecisionAnswer;
  }[];
  /** The technologies whose Development started this Turn, and those that finish as the next Turn starts. */
  developmentsStarted: string[];
  developmentsFinished: string[];
  /** Each technology the Turn's Mission flew before it was Flight-proven, and whether that flight failed to prove it. */
  unprovenFlights: { name: string; failed: boolean }[];
  /** How many Crew the Turn's Mission carried, which is 0 with no Crewed Mission. */
  crewFlown: number;
  /** How many Crew were lost this Turn, for each reason. */
  crewLost: Record<CrewLossCause, number>;
  /** How many Crew came home safe this Turn, from a journey home or on a Free-return. */
  crewHome: number;
  /**
   * The same Crew by how they came home: on the journey home of a round trip, on one in a return vehicle that fetched
   * them, or on a Free-return.
   */
  crewHomeBy: { roundTrip: number; fetched: number; freeReturn: number };
  /** How many Crew were lost on their journey home this Turn, by the Mission Event that failed, or "Health" or "Supplies". */
  crewLostOnWayHome: Record<string, number>;
  /** How many Crew are at Mars as the Turn ends. */
  crewAtMars: number;
  /** The ascent propellant fuel plants made this Turn, in kilograms, at every Landing Site together. */
  ascentPropellantKg: number;
  /** The ascent propellant Mars ascent used this Turn, in kilograms, as Crew left a Landing Site. */
  ascentPropellantUsedKg: number;
  /** The Health habitats saved this Turn, for every Crew member together. */
  healthSavedByHabitats: number;
  /** What Mars labs added to Research Grants this Turn, in millions, for everything they raised together. */
  grantsAddedByLabsMillions: number;
  /** The samples that reached Earth this Turn, with Crew or aboard an Earth return orbiter, and the Science they earned. */
  samplesHome: number;
  sampleScience: number;
  /** The samples lost on the way home this Turn, aboard an Earth return orbiter or with Crew. */
  samplesLost: number;
  /** What the Program's backers paid as the Turn ended. */
  baseFundingMillions: number;
  /**
   * For a strategy with a goal, whether the Program has reached it as the Turn ends, and whether it can no longer.
   * Left out for any other strategy.
   */
  goal?: { reached: boolean; cantRecover: boolean };
}

/** What a strategy may ask about the Program it is planning for, which it never sees itself. */
export function planningTools(
  simulation: Simulation,
  program: Program,
): PlanningTools {
  return {
    previewAssets: (mission) => simulation.previewAssets(program, mission),
    previewMission: (mission) => simulation.previewMission(program, mission),
    previewTrajectories: (mission) => simulation.previewTrajectories(mission),
    previewCrew: (mission) => simulation.previewCrew(program, mission),
    problemsWith: (plan) => simulation.validatePlan(program, plan).problems,
    costOf: (plan) => {
      const { costMillions, developmentCostMillions } = simulation.validatePlan(
        program,
        plan,
      );
      return costMillions + developmentCostMillions;
    },
  };
}

function recordOf(
  before: ProgramView,
  plan: TurnPlan,
  summary: TurnSummary,
  after: ProgramView,
  fetched: ReadonlySet<string>,
  goal: Strategy["goal"],
): TurnRecord {
  const decisions = decisionsIn(summary);
  return {
    ...(goal
      ? {
          goal: {
            reached: goal.reached(after),
            cantRecover: goal.cantRecover(after),
          },
        }
      : {}),
    moneyMillions: after.moneyMillions,
    science: after.science,
    publicSupport: after.publicSupport,
    assetsOperating: after.operatingAssets.length,
    cancelled: after.status.kind === "cancelled",
    spentMillions:
      summary.missionCostMillions +
      summary.developmentCostMillions +
      summary.upkeepMillions,
    thresholdMillions: summary.fundingPayouts.reduce(
      (total, { payoutMillions }) => total + payoutMillions,
      0,
    ),
    researchGrantMillions: summary.researchGrantMillions,
    thresholdsReached: summary.fundingPayouts.map(
      ({ publicSupport }) => publicSupport,
    ),
    researchScience: summary.ongoingResearch.map(
      ({ activityName, science }) => ({ activityName, science }),
    ),
    benefitScience: summary.ongoingResearch.reduce(
      (total, { benefit }) => total + (benefit?.science ?? 0),
      0,
    ),
    assetsFailed: summary.assetsFailed.length,
    launched: plan.mission !== null,
    missionFailed: summary.failure !== null,
    decisionPoints: decisions.length,
    rescues: summary.contingencies.filter(({ rescued }) => rescued).length,
    decisions,
    developmentsStarted: summary.developmentsStarted,
    developmentsFinished: summary.developmentsFinished,
    unprovenFlights: unprovenOn(before, plan).map((name) => ({
      name,
      failed: !summary.technologiesProven.includes(name),
    })),
    crewFlown: plan.mission?.crew?.size ?? 0,
    crewLost: crewLostIn(summary),
    crewHome: summary.crewHome.length,
    crewHomeBy: crewHomeBy(summary, fetched),
    crewLostOnWayHome: crewLostOnWayHome(summary),
    crewAtMars: summary.crew.length,
    ascentPropellantKg: summary.ascentPropellant.reduce(
      (total, { madeKg }) => total + madeKg,
      0,
    ),
    ascentPropellantUsedKg: summary.ascentPropellantUsed.reduce(
      (total, { usedKg }) => total + usedKg,
      0,
    ),
    healthSavedByHabitats: summary.healthLost.reduce(
      (total, { savedByHabitat = 0 }) => total + savedByHabitat,
      0,
    ),
    grantsAddedByLabsMillions: summary.researchGrants.reduce(
      (total, { benefit }) => total + (benefit?.millions ?? 0),
      0,
    ),
    samplesHome: summary.samplesHome.reduce(
      (total, { samples }) => total + samples,
      0,
    ),
    sampleScience: summary.samplesHome.reduce(
      (total, { science }) => total + science,
      0,
    ),
    samplesLost:
      (summary.journeyHome?.failure ? summary.journeyHome.samples : 0) +
      (summary.sampleJourney?.failure ? summary.sampleJourney.samples : 0),
    baseFundingMillions: summary.baseFundingMillions,
  };
}

/** The Crew home safe this Turn by how they came home, given the Crew a return vehicle has fetched. */
function crewHomeBy(
  summary: TurnSummary,
  fetched: ReadonlySet<string>,
): TurnRecord["crewHomeBy"] {
  const journeyed = new Set(summary.journeyHome?.crew);
  const by = { roundTrip: 0, fetched: 0, freeReturn: 0 };
  for (const name of summary.crewHome) {
    if (!journeyed.has(name)) by.freeReturn++;
    else if (fetched.has(name)) by.fetched++;
    else by.roundTrip++;
  }
  return by;
}

/** The Crew lost on this Turn's journey home, by the Mission Event that failed, or "Health" or "Supplies". */
function crewLostOnWayHome(summary: TurnSummary): Record<string, number> {
  const { journeyHome } = summary;
  if (!journeyHome) return {};
  const journeyed = new Set(journeyHome.crew);
  const lost: Record<string, number> = {};
  for (const { cause, names } of summary.crewLost) {
    const count = names.filter((name) => journeyed.has(name)).length;
    if (count === 0) continue;
    const key =
      cause === "missionEvent"
        ? (journeyHome.failure?.missionEventName ?? "Mission Event")
        : cause === "health"
          ? "Health"
          : cause === "supplies"
            ? "Supplies"
            : "Solar particle event";
    lost[key] = (lost[key] ?? 0) + count;
  }
  return lost;
}

/** How many Crew a Turn's summary says were lost, for each reason. */
function crewLostIn(summary: TurnSummary): TurnRecord["crewLost"] {
  const lost = {
    missionEvent: 0,
    health: 0,
    supplies: 0,
    solarParticleEvent: 0,
  };
  for (const { cause, names } of summary.crewLost) lost[cause] += names.length;
  return lost;
}

/** The technologies on a plan's Mission that aren't Flight-proven as the Turn starts, by name. */
function unprovenOn(view: ProgramView, plan: TurnPlan) {
  return technologiesOn(view, plan.mission)
    .filter(
      ({ technologyReadiness }) => technologyReadiness !== "flight-proven",
    )
    .map(({ name }) => name);
}

/** Every Decision Point a Turn's summary reports, with how it was answered. */
function decisionsIn(summary: TurnSummary): TurnRecord["decisions"] {
  return [
    ...summary.contingencies.map(({ answer }) => ({
      kind: "contingency" as const,
      answer,
    })),
    ...summary.dustStorms.map(({ answer }) => ({
      kind: "dustStorm" as const,
      answer,
    })),
    ...(summary.solarParticleEvent
      ? [
          {
            kind:
              summary.solarParticleEvent.crew.length > 0
                ? ("crewedSolarParticleEvent" as const)
                : ("solarParticleEvent" as const),
            answer: summary.solarParticleEvent.answer,
          },
        ]
      : []),
    ...(summary.goNoGo
      ? [{ kind: "goNoGo" as const, answer: summary.goNoGo.answer }]
      : []),
  ];
}

/** Works out a Turn, answering each Decision Point as the strategy would, one at a time as a player does. */
function playTurn(
  simulation: Simulation,
  strategy: Strategy,
  program: Program,
  view: ProgramView,
  plan: TurnPlan,
): TurnResult {
  let answers: DecisionAnswers = {};
  let progress = simulation.workOutTurn(program, plan);
  while (progress.decisionPoint) {
    const { decisionPoint } = progress;
    answers = {
      ...answers,
      [decisionPoint.id]:
        strategy.answer?.(decisionPoint, view, plan) ??
        decisionPoint.choices[0].answer,
    };
    progress = simulation.workOutTurn(program, plan, answers);
  }
  return progress.result;
}

/**
 * Plays one Program by a strategy until it ends or the Turns run out, through the Simulation's public interface.
 * Throws if the strategy submits a plan that fails validation, or if a Turn leaves an invalid state.
 */
export function playProgram(
  simulation: Simulation,
  strategy: Strategy,
  seed: number,
  turns: number,
): { program: Program; turns: TurnRecord[] } {
  let program = simulation.startProgram(seed);
  let view = simulation.readProgram(program);
  const records: TurnRecord[] = [];
  // The Crew a return vehicle has fetched, who come home on a journey of their own on a later Turn.
  const fetched = new Set<string>();
  const fail = (problems: string[]) =>
    new Error(
      `Strategy "${strategy.name}", seed ${seed}, Turn ${view.turnNumber}: ${problems.join(" ")}`,
    );

  while (records.length < turns && view.status.kind === "active") {
    const plan = strategy.plan(view, planningTools(simulation, program));
    const { problems } = simulation.validatePlan(program, plan);
    if (problems.length > 0) throw fail(problems);

    const result = playTurn(simulation, strategy, program, view, plan);
    const after = simulation.readProgram(result.program);
    const invalid = [
      ...invalidStates(view, result.summary, after),
      ...crewProblems(view, result.summary, after),
      ...homecomingProblems(view, result.summary, after),
      ...fetchingProblems(view, result.summary, after),
      ...propellantProblems(view, result.summary, after),
      ...habitatProblems(view, result.summary, after),
      ...labProblems(view, result.summary, after),
      ...sampleProblems(view, result.summary, after),
      ...timelineMissionEventProblems(result.timeline, result.summary),
    ];
    if (invalid.length > 0) throw fail(invalid);

    for (const name of result.summary.returnVehicle?.crew ?? []) {
      fetched.add(name);
    }
    records.push(
      recordOf(view, plan, result.summary, after, fetched, strategy.goal),
    );
    program = result.program;
    view = after;
  }
  return { program, turns: records };
}
