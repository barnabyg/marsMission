import { planningTools } from "../balance/playProgram";
import type { PlanningTools } from "../balance/strategy";
import type {
  DecisionAnswers,
  Program,
  ProgramView,
  Simulation,
  TurnPlan,
} from "../simulation/simulation";
import {
  decisionAdvice,
  planningAdvice,
  type PlanningAdvice,
} from "./tutorial";

/** One Turn's start as the tutorial sees it: the Program, its view and tools, and the advice for it. */
export interface TurnStart {
  program: Program;
  view: ProgramView;
  tools: PlanningTools;
  advice: PlanningAdvice;
}

/** The start of a Turn of this Program, with the tutorial's advice for it, given the last Turn if there was one. */
export function startOf(
  simulation: Simulation,
  program: Program,
  last: { start: TurnStart; plan: TurnPlan } | null = null,
): TurnStart {
  const view = simulation.readProgram(program);
  const tools = planningTools(simulation, program);
  const advice = planningAdvice(
    view,
    tools,
    last
      ? { view: last.start.view, tools: last.start.tools, plan: last.plan }
      : null,
  );
  return { program, view, tools, advice };
}

/** The Program after playing this plan, answering each Decision Point as the tutorial advises. */
export function play(
  simulation: Simulation,
  { program, view }: TurnStart,
  plan: TurnPlan,
): Program {
  let answers: DecisionAnswers = {};
  let progress = simulation.workOutTurn(program, plan);
  while (progress.decisionPoint) {
    const { decisionPoint } = progress;
    answers = {
      ...answers,
      [decisionPoint.id]: decisionAdvice(decisionPoint, view, plan).answer,
    };
    progress = simulation.workOutTurn(program, plan, answers);
  }
  return progress.result.program;
}

/**
 * Follows the tutorial's advice on this Program, Turn after Turn, until a Turn's start passes the test or the Program
 * ends, up to a number of Turns. Gives every Turn's start, the last one first passing the test if any did.
 */
export function followAdvice(
  simulation: Simulation,
  program: Program,
  until: (start: TurnStart) => boolean,
  turns = 30,
): TurnStart[] {
  const starts = [startOf(simulation, program)];
  for (let turn = 0; turn < turns; turn++) {
    const start = starts.at(-1);
    if (!start || until(start) || start.view.status.kind !== "active") break;
    const plan = start.advice.plan;
    starts.push(
      startOf(simulation, play(simulation, start, plan), { start, plan }),
    );
  }
  return starts;
}
