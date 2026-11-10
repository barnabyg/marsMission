import type { Catalogue } from "../catalogue/catalogue";
import { takeBailout } from "./bailout";
import { createRules } from "./rules";
import type { PlannedCrew } from "./crewView";
import { createMissionPreviews } from "./missionPreviews";
import { createPlanCheck } from "./planCheck";
import { newProgram, programView } from "./programView";
import { programSummary, type ProgramSummary } from "./programSummary";
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
  TutorialOutcome,
} from "./types";

export {
  addDays,
  daysBetween,
  formatDays,
  formatMoney,
  formatTurns,
} from "./rules";
export {
  whatActivityDoes,
  onlyGrantsPay,
  paysForItself,
  serviceLifeGain,
} from "./choiceText";
export { formatPropellant } from "./ascentPropellant";
export { corruptSave, SaveError } from "./restoreSave";
export {
  canFly,
  everyTechnology,
  technologiesOn,
  type TechnologyReadiness,
} from "./technologyReadiness";
export type { PlannedCrew } from "./crewView";
export { healthLossCauses } from "./health";
export type { BailoutView } from "./bailout";
export type {
  AssetChoices,
  BenefitImpact,
  CrewLossCause,
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  GrantImpact,
  Program,
  ProgramView,
  TurnPlan,
  TurnProgress,
  TurnResult,
  TutorialMode,
} from "./types";
export type {
  PlannedActivity,
  PlannedAsset,
  PlannedDevelopment,
  PlannedServiceLife,
  PlannedTrajectory,
} from "./previews";
export type { ProgramSummary } from "./programSummary";
export type { TurnSummary } from "./turnSummary";
export type {
  AssetAtMars,
  CrewMemberAtMarsOnTimeline,
  JourneyHomeOnTimeline,
  Timeline,
  TimelineEntry,
} from "./timeline";

export interface Simulation {
  /** A new Program, with Tutorial mode only if the player chose it. */
  startProgram(seed: number, options?: { tutorial?: boolean }): Program;
  /** Turns Tutorial mode on or off. Throws once the tutorial has ended, as it can't be turned on again. */
  setTutorial(program: Program, on: boolean): Program;
  /** Ends Tutorial mode for good, at its goal or once it couldn't recover. Throws unless it is on. */
  endTutorial(program: Program, outcome: TutorialOutcome): Program;
  /** A Program as data that can be kept and given to restoreProgram later. */
  saveProgram(program: Program): SavedProgram;
  /** The Program in a save, which plays on as if it was never saved. Throws a SaveError if it can't be continued. */
  restoreProgram(saved: unknown): Program;
  readProgram(program: Program): ProgramView;
  /** How a Program went over all its Turns, for the summary shown once it ends. */
  summariseProgram(program: Program): ProgramSummary;
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
  /**
   * Takes the Bailout on offer for the Turn just played: its refund is paid now, and repaid as each of the Turns to come
   * ends. Throws unless it is on offer.
   */
  takeBailout(program: Program): Program;
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
    startProgram: (seed, { tutorial = false } = {}) =>
      newProgram(catalogue, seed, tutorial),

    setTutorial(program, on) {
      if (program.tutorial.kind === "ended") {
        throw new Error(
          "The tutorial has ended, so it can't be turned on again.",
        );
      }
      return { ...program, tutorial: { kind: on ? "on" : "off" } };
    },

    endTutorial(program, outcome) {
      if (program.tutorial.kind !== "on") {
        throw new Error("The tutorial isn't on, so it can't end.");
      }
      return { ...program, tutorial: { kind: "ended", outcome } };
    },

    saveProgram,

    restoreProgram: (saved) => restoreProgram(saved, catalogue),

    readProgram: (program) => programView(catalogue, rules, program),

    summariseProgram: (program) => programSummary(catalogue, program),

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

    takeBailout: (program) => takeBailout(catalogue, program),
  };
}
