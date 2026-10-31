import type {
  Program,
  Simulation,
  TurnSummary,
} from "../simulation/simulation";
import { invalidStates } from "./invalidStates";
import type { PlanningTools, Strategy } from "./strategies";

/** What a report needs from one Turn of one Program. */
export interface TurnRecord {
  /** The Program at the end of the Turn. */
  moneyMillions: number;
  science: number;
  publicSupport: number;
  assetsOperating: number;
  cancelled: boolean;
  /** From the Turn's summary. */
  missionCostMillions: number;
  thresholdMillions: number;
  researchGrantMillions: number;
  thresholdsReached: number[];
  researchScience: { activityName: string; science: number }[];
  assetsFailed: number;
  launched: boolean;
  missionFailed: boolean;
}

/** What a strategy may ask about the Program it is planning for, which it never sees itself. */
export function planningTools(
  simulation: Simulation,
  program: Program,
): PlanningTools {
  return {
    previewAssets: (mission) => simulation.previewAssets(mission),
    previewMission: (mission) => simulation.previewMission(program, mission),
    problemsWith: (plan) => simulation.validatePlan(program, plan).problems,
  };
}

function recordOf(
  launched: boolean,
  summary: TurnSummary,
  after: ReturnType<Simulation["readProgram"]>,
): TurnRecord {
  return {
    moneyMillions: after.moneyMillions,
    science: after.science,
    publicSupport: after.publicSupport,
    assetsOperating: after.operatingAssets.length,
    cancelled: after.status.kind === "cancelled",
    missionCostMillions: summary.missionCostMillions,
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
  };
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

    const result = simulation.runTurn(program, plan);
    const after = simulation.readProgram(result.program);
    const invalid = invalidStates(view, result.summary, after);
    if (invalid.length > 0) throw fail(invalid);

    records.push(recordOf(plan.mission !== null, result.summary, after));
    program = result.program;
    view = after;
  }
  return { program, turns: records };
}
