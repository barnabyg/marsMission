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
      /** The plan played on the last Turn, for the tutorial to spot a change of course, or null whenever lastTurn is. */
      lastPlan: TurnPlan | null;
      /** Whether this is the Program's first Planning session since it started, which offers Tutorial mode. */
      firstSession: boolean;
    }
  | {
      mode: "mission";
      program: Program;
      plan: TurnPlan;
      answers: DecisionAnswers;
      progress: TurnProgress;
    }
  | {
      mode: "turnSummary";
      result: TurnResult;
      lastTurn: Program;
      lastPlan: TurnPlan;
    }
  | { mode: "programSummary"; program: Program };

type PlanningScreen = Extract<Screen, { mode: "planning" }>;

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
  lastTurn: { program: Program; plan: TurnPlan } | null = null,
): PlanningScreen {
  return {
    mode: "planning",
    program,
    lastTurn: lastTurn?.program ?? null,
    lastPlan: lastTurn?.plan ?? null,
    saved: saveStore.save("automatic", program),
    // Each visit starts a fresh plan, even when a load returns to the same Program and Turn.
    visit: ++planningVisits,
    firstSession: false,
  };
}

/** A new Program's first Planning session, which offers Tutorial mode. */
export function newProgramScreen(services: GameServices): Screen {
  const { simulation, newSeed } = services;
  return {
    ...planningScreen(services, simulation.startProgram(newSeed())),
    firstSession: true,
  };
}

/**
 * The same Planning session with Tutorial mode turned on or off, saved again so that the choice survives closing the
 * game. The plan being made is kept.
 */
export function withTutorial(
  { simulation, saveStore }: GameServices,
  screen: PlanningScreen,
  on: boolean,
): PlanningScreen {
  const program = simulation.setTutorial(screen.program, on);
  return { ...screen, program, saved: saveStore.save("automatic", program) };
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
