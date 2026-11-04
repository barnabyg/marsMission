import type { Program, Simulation, TurnPlan } from "../simulation/simulation";

/** What the New Mission could add: an Asset, or Crew of this size. */
export type Addition = { assetId: string } | { crewSize: number };

/** Whether adding something to a Mission would take it over its Launch Vehicle's capacity, or over the Money. */
export interface Fit {
  overCapacity: boolean;
  overMoney: boolean;
}

/**
 * Whether adding this to the plan's Mission would take it over its Launch Vehicle's capacity or over the Money
 * available. The Simulation works out the cost and mass of the plan with it added, so the rules for both stay there.
 */
export function fitOfAdding(
  simulation: Simulation,
  program: Program,
  plan: TurnPlan,
  moneyMillions: number,
  addition: Addition,
): Fit {
  if (!plan.mission) return { overCapacity: false, overMoney: false };
  const mission =
    "assetId" in addition
      ? {
          ...plan.mission,
          assetIds: [...plan.mission.assetIds, addition.assetId],
        }
      : { ...plan.mission, crew: { size: addition.crewSize } };
  const check = simulation.validatePlan(program, { ...plan, mission });
  return {
    overCapacity: check.massTonnes > check.capacityTonnes,
    overMoney:
      check.costMillions + check.developmentCostMillions > moneyMillions,
  };
}
