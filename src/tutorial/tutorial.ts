import { playStyle } from "../balance/playStyle";
import type { PlanningTools, Strategy } from "../balance/strategy";
import type { ProgramView, TurnPlan } from "../simulation/simulation";
import type { AdviceItem } from "./adviceItems";
import { crewAtBase } from "./base";
import { changeOfCourse, type LastTurn } from "./changeOfCourse";
import { decisionAdvice } from "./decisions";
import { routeStyle } from "./route";
import { stageOf, type StageId } from "./stages";
import { tutorialStatus } from "./status";
import { itemsFor } from "./turnAdvice";

/*
 * The tutorial's brain: the advice for each Planning session and Decision Point, and whether the tutorial has reached
 * its goal, Crew at a Base, or can no longer reach it. It works everything out afresh from what the player sees, so it
 * copes with failures, Hazards and advice not followed. The UI only renders what it gives.
 */

export type { AdviceItem, AdviceTopic } from "./adviceItems";
export { crewAtBase } from "./base";
export type { LastTurn } from "./changeOfCourse";
export { decisionAdvice, type DecisionAdvice } from "./decisions";
export { stages, type Stage, type StageId } from "./stages";
export {
  tutorialStatus,
  type TutorialEnd,
  type TutorialStatus,
} from "./status";

export interface PlanningAdvice {
  stage: StageId;
  /** Why the advice changed course since last Turn, or null if it didn't (or there is no last Turn). */
  changeOfCourse: string | null;
  items: AdviceItem[];
  /** The plan the advice describes. It passes validation: tools.problemsWith(plan) is empty. */
  plan: TurnPlan;
}

/** The plan the tutorial's route makes this Turn. */
function routePlan(view: ProgramView, tools: PlanningTools): TurnPlan {
  return playStyle("", "", routeStyle(view)).plan(view, tools);
}

/** The advice for this Turn's Planning session, given the last Turn if there was one in this session. */
export function planningAdvice(
  view: ProgramView,
  tools: PlanningTools,
  lastTurn: LastTurn | null,
): PlanningAdvice {
  const plan = routePlan(view, tools);
  return {
    stage: stageOf(view),
    changeOfCourse: lastTurn
      ? changeOfCourse(
          lastTurn,
          routePlan(lastTurn.view, lastTurn.tools),
          view,
          plan,
        )
      : null,
    items: itemsFor(view, tools, plan),
    plan,
  };
}

export const tutorialName = "tutorial: build a Base and land Crew there";

/** The tutorial's advice played as a strategy, for the balance runs: it always follows its own advice. */
export const tutorialStrategy: Strategy = {
  name: tutorialName,
  description:
    "The tutorial's advice, followed every Turn: an orbiter to Survey, then rovers on Research Grants at surveyed Landing Sites, keeping up to six Assets, sending no landers and keeping no money back, with the best Reliability on every Mission Event it can afford and the longest Service Life for rovers. Once it has $5B it develops the Meridian Colossus, and once that is built and it has $6B, it flies the whole Base on it to the surveyed Landing Site with the most Science: a Wellspring Fuel Plant, a Haven Module and Curie Station, each with its longest Service Life and best Reliability, replacing any that stop. It then saves, keeping two rovers there, until it can land the smallest Crew there on a round trip with the best Reliability on every Mission Event. It reaches its goal when Crew are at a Landing Site where a fuel plant, a Habitat and a Mars lab operate. After its goal it plays on, as the tutorial no longer advises the player, bringing Crew home once one has less than 45 Health or their Supplies wouldn't last another Turn.",
  plan: (view, tools) => planningAdvice(view, tools, null).plan,
  answer: (decisionPoint, view, plan) =>
    decisionAdvice(decisionPoint, view, plan).answer,
  goal: {
    reached: crewAtBase,
    cantRecover: (view) => tutorialStatus(view).kind === "cantRecover",
  },
};
