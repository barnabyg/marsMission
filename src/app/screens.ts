import {
  manualSlots,
  type LoadedSave,
  type SaveStore,
} from "../save/saveStore";
import type {
  DecisionAnswers,
  Program,
  Simulation,
  TurnPlan,
  TurnProgress,
  TurnResult,
} from "../simulation/simulation";

export type Screen =
  | { mode: "opening"; automaticSave: LoadedSave }
  | {
      mode: "planning";
      program: Program;
      /** The Program at the start of the last Turn, to show what changed, or null on the first Turn or after a Load. */
      lastTurn: Program | null;
      saved: boolean;
      visit: number;
    }
  | {
      mode: "mission";
      program: Program;
      plan: TurnPlan;
      answers: DecisionAnswers;
      progress: TurnProgress;
    }
  | { mode: "turnSummary"; result: TurnResult; lastTurn: Program }
  | { mode: "programSummary"; program: Program };

export interface GameServices {
  simulation: Simulation;
  saveStore: SaveStore;
  newSeed: () => number;
}

let planningVisits = 0;

/** Entering Planning Mode is what saves the game, so a save always holds the start of a Turn. */
export function planningScreen(
  { saveStore }: GameServices,
  program: Program,
  lastTurn: Program | null = null,
): Screen {
  return {
    mode: "planning",
    program,
    lastTurn,
    saved: saveStore.save("automatic", program),
    // Each visit starts a fresh plan, even when a load returns to the same Program and Turn.
    visit: ++planningVisits,
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
