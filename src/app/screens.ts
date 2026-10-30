import {
  manualSlots,
  type LoadedSave,
  type SaveStore,
} from "../save/saveStore";
import type { Program, Simulation, TurnResult } from "../simulation/simulation";

export type Screen =
  | { mode: "opening"; automaticSave: LoadedSave }
  | { mode: "planning"; program: Program; saved: boolean }
  | { mode: "mission"; result: TurnResult }
  | { mode: "turnSummary"; result: TurnResult }
  | { mode: "programSummary"; program: Program };

export interface GameServices {
  simulation: Simulation;
  saveStore: SaveStore;
  newSeed: () => number;
}

/** Entering Planning Mode is what saves the game, so a save always holds the start of a Turn. */
export function planningScreen(
  { saveStore }: GameServices,
  program: Program,
): Screen {
  return {
    mode: "planning",
    program,
    saved: saveStore.save("automatic", program),
  };
}

export function newProgramScreen(services: GameServices): Screen {
  const { simulation, newSeed } = services;
  return planningScreen(services, simulation.startProgram(newSeed()));
}

/** What opening the game shows: a choice if anything has been saved, and a new Program if not. */
export function openingScreen(services: GameServices): Screen {
  const { saveStore } = services;
  const automaticSave = saveStore.load("automatic");
  const nothingSaved =
    automaticSave.kind === "empty" &&
    manualSlots.every((slot) => saveStore.load(slot).kind === "empty");
  return nothingSaved
    ? newProgramScreen(services)
    : { mode: "opening", automaticSave };
}
