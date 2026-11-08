import { useMemo } from "react";
import { planningTools } from "../balance/playProgram";
import type { Program, Simulation, TurnPlan } from "../simulation/simulation";
import { planningAdvice, type PlanningAdvice } from "../tutorial/tutorial";

/**
 * The tutorial's advice for this Planning session, or null while Tutorial mode is off or has ended. It is worked out
 * once a visit, from the Program as it stands and, to spot a change of course, the last Turn and the plan played in it.
 */
export function useTutorialAdvice(
  simulation: Simulation,
  program: Program,
  lastTurn: Program | null,
  lastPlan: TurnPlan | null,
): PlanningAdvice | null {
  return useMemo(() => {
    const view = simulation.readProgram(program);
    if (view.tutorial.kind !== "on") return null;
    return planningAdvice(
      view,
      planningTools(simulation, program),
      lastTurn && lastPlan
        ? {
            view: simulation.readProgram(lastTurn),
            tools: planningTools(simulation, lastTurn),
            plan: lastPlan,
          }
        : null,
    );
  }, [simulation, program, lastTurn, lastPlan]);
}
