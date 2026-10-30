import { useState } from "react";
import {
  formatMoney,
  type Program,
  type Simulation,
} from "../simulation/simulation";
import { formatLaunchWindow } from "../ui/format";
import { GameText } from "../ui/GameText";
import { manualSlots, type LoadedSave, type SaveStore } from "./saveStore";

type ManualSlot = (typeof manualSlots)[number];

interface SaveAction {
  kind: "save";
  program: Program;
  onSaved: (slot: ManualSlot) => void;
}

interface LoadAction {
  kind: "load";
  /** Whether loading would replace a Program in play or in the automatic save, and so needs confirming. */
  confirm: boolean;
  onLoad: (program: Program) => void;
}

interface SaveSlotsProps {
  simulation: Simulation;
  saveStore: SaveStore;
  /** What choosing a slot does. */
  action: SaveAction | LoadAction;
}

type Confirming =
  | { action: "overwrite"; slot: ManualSlot }
  | { action: "load"; slot: ManualSlot; program: Program };

/** Lists the Save Slots with what's in them, and saves to or loads from the one chosen. */
export function SaveSlots({ simulation, saveStore, action }: SaveSlotsProps) {
  const [slots] = useState(() =>
    manualSlots.map((slot) => saveStore.load(slot)),
  );
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  function saveTo(slot: ManualSlot, { program, onSaved }: SaveAction) {
    setConfirming(null);
    if (saveStore.save(slot, program)) onSaved(slot);
    else setSaveFailed(true);
  }

  function describe(loaded: LoadedSave): string {
    if (loaded.kind === "empty") return "Empty";
    if (loaded.kind === "problem") return loaded.message;
    const view = simulation.readProgram(loaded.program);
    return `Turn ${view.turnNumber}, ${formatLaunchWindow(view.date)}, ${formatMoney(view.moneyMillions)}, ${view.publicSupport} Public Support`;
  }

  return (
    <>
      {saveFailed && (
        <p className="problem" role="alert">
          The browser wouldn't store that save.
        </p>
      )}
      <ul className="save-slots">
        {manualSlots.map((slot, index) => {
          const loaded = slots[index] ?? { kind: "empty" };
          return (
            <li key={slot} data-testid={`save-slot-${slot}`}>
              <div className="save-slot-row">
                <strong>{slot}</strong>
                <span
                  className={
                    loaded.kind === "problem"
                      ? "save-slot-text problem"
                      : "save-slot-text"
                  }
                >
                  <GameText>{describe(loaded)}</GameText>
                </span>
                {action.kind === "save" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (loaded.kind === "empty") saveTo(slot, action);
                      else setConfirming({ action: "overwrite", slot });
                    }}
                  >
                    Save here
                  </button>
                )}
                {action.kind === "load" && loaded.kind === "program" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (action.confirm) {
                        setConfirming({
                          action: "load",
                          slot,
                          program: loaded.program,
                        });
                      } else action.onLoad(loaded.program);
                    }}
                  >
                    Load
                  </button>
                )}
              </div>
              {action.kind === "save" &&
                confirming?.action === "overwrite" &&
                confirming.slot === slot && (
                  <div
                    role="group"
                    aria-label="Confirm overwriting"
                    className="confirm"
                  >
                    <p>Overwrite what's saved in this slot?</p>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        saveTo(slot, action);
                      }}
                    >
                      Yes, overwrite it
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                      }}
                    >
                      Keep it
                    </button>
                  </div>
                )}
              {action.kind === "load" &&
                confirming?.action === "load" &&
                confirming.slot === slot && (
                  <div
                    role="group"
                    aria-label="Confirm loading"
                    className="confirm"
                  >
                    <p>
                      <GameText>
                        Load this save? It replaces your current Program, which
                        is lost unless it's in a slot.
                      </GameText>
                    </p>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setConfirming(null);
                        action.onLoad(confirming.program);
                      }}
                    >
                      Yes, load it
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                      }}
                    >
                      Keep playing
                    </button>
                  </div>
                )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
