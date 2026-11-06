import type { Catalogue } from "../catalogue/catalogue";
import { createRules } from "./rules";
import type { PlannedCrew } from "./crewView";
import { createMissionPreviews } from "./missionPreviews";
import { createPlanCheck } from "./planCheck";
import { newProgram, programView } from "./programView";
import { restoreProgram, saveProgram, type SavedProgram } from "./saveFormat";
import { workOutTurn } from "./workOutTurn";
import type {
  PlanCheck,
  PlannedAsset,
  PlannedMissionEvent,
  PlannedTrajectory,
} from "./previews";
import type {
  DecisionAnswers,
  PlannedMission,
  Program,
  ProgramView,
  TurnPlan,
  TurnProgress,
  TurnResult,
} from "./types";

export { addDays, daysBetween, formatMoney } from "./rules";
export { corruptSave, SaveError } from "./saveFormat";
export {
  canFly,
  everyTechnology,
  technologiesOn,
  type TechnologyReadiness,
} from "./technologyReadiness";
export type { PlannedCrew } from "./crewView";
export { healthLossCauses } from "./health";
export type {
  AssetChoices,
  BenefitImpact,
  CrewLossCause,
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  Program,
  ProgramView,
  TurnPlan,
  TurnProgress,
  TurnResult,
} from "./types";
export type {
  PlannedActivity,
  PlannedAsset,
  PlannedDevelopment,
  PlannedTrajectory,
} from "./previews";
export type { TurnSummary } from "./turnSummary";
export type {
  AssetAtMars,
  CrewMemberAtMarsOnTimeline,
  Timeline,
  TimelineEntry,
} from "./timeline";

export interface Simulation {
  startProgram(seed: number): Program;
  /** A Program as data that can be kept and given to restoreProgram later. */
  saveProgram(program: Program): SavedProgram;
  /** The Program in a save, which plays on as if it was never saved. Throws a SaveError if it can't be continued. */
  restoreProgram(saved: unknown): Program;
  readProgram(program: Program): ProgramView;
  validatePlan(program: Program, plan: TurnPlan): PlanCheck;
  /** The Mission Events a Mission would go through, in order. Ids that aren't in the catalogue are skipped. */
  previewMission(
    program: Program,
    mission: PlannedMission,
  ): PlannedMissionEvent[];
  /** The choices a Mission can make for each Asset it carries. Ids that aren't in the catalogue are skipped. */
  previewAssets(program: Program, mission: PlannedMission): PlannedAsset[];
  /** The Trajectories on offer to a Mission, in the order the Catalogue lists them. */
  previewTrajectories(mission: PlannedMission): PlannedTrajectory[];
  /** The Crew a Mission would carry, who they are and what they could do, or null if it carries none. */
  previewCrew(program: Program, mission: PlannedMission): PlannedCrew | null;
  /** Works out a Turn from the seed, the plan and the answers so far, stopping at the first Decision Point with no answer. */
  workOutTurn(
    program: Program,
    plan: TurnPlan,
    answers?: DecisionAnswers,
  ): TurnProgress;
  /** The whole of a Turn that has an answer for every Decision Point it meets. Throws if it hasn't. */
  runTurn(
    program: Program,
    plan: TurnPlan,
    answers?: DecisionAnswers,
  ): TurnResult;
  retireProgram(program: Program): Program;
}

export function createSimulation(catalogue: Catalogue): Simulation {
  const rules = createRules(catalogue);
  const checkPlan = createPlanCheck(catalogue, rules);
  const turnFrom = (
    program: Program,
    plan: TurnPlan,
    answers: DecisionAnswers = {},
  ): TurnProgress =>
    workOutTurn(catalogue, rules, checkPlan, program, plan, answers);

  return {
    startProgram: (seed) => newProgram(catalogue, seed),

    saveProgram,

    restoreProgram: (saved) => restoreProgram(saved, catalogue),

    readProgram: (program) => programView(catalogue, rules, program),

    validatePlan: checkPlan,

    ...createMissionPreviews(catalogue, rules),

    workOutTurn: turnFrom,

    runTurn(program, plan, answers) {
      const progress = turnFrom(program, plan, answers);
      if (progress.decisionPoint) {
        throw new Error(
          `This Turn stops at a Decision Point with no answer: ${progress.decisionPoint.id}.`,
        );
      }
      return progress.result;
    },

    retireProgram(program) {
      if (program.status.kind !== "active") {
        throw new Error("This Program has ended.");
      }
      return { ...program, status: { kind: "retired" } };
    },
  };
}
