import type {
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  Program,
  ProgramView,
  Simulation,
  TurnPlan,
  TurnResult,
  TurnSummary,
} from "../simulation/simulation";
import { invalidStates, missionEventProblems } from "./invalidStates";
import type { PlanningTools, Strategy } from "./playStyle";

/** What a report needs from one Turn of one Program. */
export interface TurnRecord {
  /** The Program at the end of the Turn. */
  moneyMillions: number;
  science: number;
  publicSupport: number;
  assetsOperating: number;
  cancelled: boolean;
  /** From the Turn's summary. What its Mission and any Development cost. */
  spentMillions: number;
  thresholdMillions: number;
  researchGrantMillions: number;
  thresholdsReached: number[];
  researchScience: { activityName: string; science: number }[];
  assetsFailed: number;
  launched: boolean;
  missionFailed: boolean;
  /** How many Decision Points came up, and how many Contingencies ended with the Assets saved. */
  decisionPoints: number;
  rescues: number;
  /** Each Decision Point answered, by kind. */
  decisions: { kind: DecisionPoint["kind"]; answer: DecisionAnswer }[];
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
  launched: boolean,
  summary: TurnSummary,
  after: ReturnType<Simulation["readProgram"]>,
): TurnRecord {
  const decisions = decisionsIn(summary);
  return {
    moneyMillions: after.moneyMillions,
    science: after.science,
    publicSupport: after.publicSupport,
    assetsOperating: after.operatingAssets.length,
    cancelled: after.status.kind === "cancelled",
    spentMillions:
      summary.missionCostMillions + summary.developmentCostMillions,
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
    assetsFailed: summary.assetsFailed.length,
    launched,
    missionFailed: summary.failure !== null,
    decisionPoints: decisions.length,
    rescues: summary.contingencies.filter(({ rescued }) => rescued).length,
    decisions,
  };
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
            kind: "solarParticleEvent" as const,
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
        strategy.answer?.(decisionPoint, view) ??
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
      ...missionEventProblems(result.timeline, result.summary),
    ];
    if (invalid.length > 0) throw fail(invalid);

    records.push(recordOf(plan.mission !== null, result.summary, after));
    program = result.program;
    view = after;
  }
  return { program, turns: records };
}
