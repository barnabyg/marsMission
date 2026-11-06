import type { Program, Simulation, TurnPlan } from "../simulation/simulation";

/** What the New Mission could add: an Asset, Crew of this size, or a return vehicle for the Crew in this place. */
export type Addition =
  { assetId: string } | { crewSize: number } | { returnVehicleFor: string };

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
      : "crewSize" in addition
        ? { ...plan.mission, crew: { size: addition.crewSize } }
        : {
            ...plan.mission,
            returnVehicle: { forCrewAt: addition.returnVehicleFor },
          };
  const check = simulation.validatePlan(program, { ...plan, mission });
  return {
    overCapacity: check.massTonnes > check.capacityTonnes,
    overMoney:
      check.costMillions + check.developmentCostMillions > moneyMillions,
  };
}

/** Why something that would take the Mission over a limit can't be ticked, or undefined if it fits. */
export function fitReason(fit: Fit): string | undefined {
  const reasons = [
    ...(fit.overCapacity ? ["Too heavy for the Launch Vehicle"] : []),
    ...(fit.overMoney ? ["Costs more than the Money left"] : []),
  ];
  return reasons.length > 0 ? `${reasons.join(" · ")}.` : undefined;
}
