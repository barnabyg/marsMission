import {
  SaveError,
  type Program,
  type Simulation,
} from "../simulation/simulation";

/** The slots the player saves to by hand. The automatic save is kept apart from them. */
export const manualSlots = [1, 2, 3] as const;

type SaveSlot = "automatic" | (typeof manualSlots)[number];

/** The parts of the browser's local storage the Save Store needs. */
type SaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What is in a save slot. A problem is a message for the player, and never stops the game. */
export type LoadedSave =
  | { kind: "empty" }
  | { kind: "program"; program: Program }
  | { kind: "problem"; message: string };

export interface SaveStore {
  /** Keeps a Program in a slot. Returns false if the browser wouldn't store it. */
  save(slot: SaveSlot, program: Program): boolean;
  load(slot: SaveSlot): LoadedSave;
  clear(slot: SaveSlot): void;
}

export function storageKeyFor(slot: SaveSlot): string {
  return `marsMission.save.${slot}`;
}

export function createSaveStore(
  storage: SaveStorage,
  simulation: Simulation,
): SaveStore {
  function readText(slot: SaveSlot): string | null {
    try {
      return storage.getItem(storageKeyFor(slot));
    } catch {
      // Storage the browser has blocked holds nothing we can reach.
      return null;
    }
  }

  return {
    save(slot, program) {
      try {
        storage.setItem(
          storageKeyFor(slot),
          JSON.stringify(simulation.saveProgram(program)),
        );
        return true;
      } catch {
        return false;
      }
    },

    load(slot) {
      const text = readText(slot);
      if (text === null) return { kind: "empty" };
      try {
        const saved: unknown = JSON.parse(text);
        return { kind: "program", program: simulation.restoreProgram(saved) };
      } catch (error) {
        return {
          kind: "problem",
          message:
            error instanceof SaveError
              ? error.message
              : "This save is corrupt, so it can't be loaded.",
        };
      }
    },

    clear(slot) {
      try {
        storage.removeItem(storageKeyFor(slot));
      } catch {
        // Storage the browser has blocked has nothing to clear.
      }
    },
  };
}
