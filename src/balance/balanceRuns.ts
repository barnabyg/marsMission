import type { Simulation } from "../simulation/simulation";
import { playProgram } from "./playProgram";
import type { Strategy } from "./strategy";

/** How many Turns each Program plays at most. */
export const turnHorizon = 20;

export function playBalancePrograms(
  simulation: Simulation,
  strategy: Strategy,
  programs: number,
) {
  return Array.from(
    { length: programs },
    (_, index) =>
      playProgram(simulation, strategy, index + 1, turnHorizon).turns,
  );
}
