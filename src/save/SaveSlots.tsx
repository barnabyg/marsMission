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

interface SaveSlotsProps {
  simulation: Simulation;
  saveStore: SaveStore;
  /** The Program to save, or null where there is none to save yet. */
  program: Program | null;
  /** Whether loading would replace a Program in play or in the automatic save, and so needs confirming. */
  confirmLoading: boolean;
  onLoad: (program: Program) => void;
}

type Confirming =
  | { action: "overwrite"; slot: ManualSlot }
  | { action: "load"; slot: ManualSlot; program: Program };

export function SaveSlots({
  simulation,
  saveStore,
  program,
  confirmLoading,
  onLoad,
}: SaveSlotsProps) {
  const [slots, setSlots] = useState(() =>
    manualSlots.map((slot) => saveStore.load(slot)),
  );
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  function saveTo(slot: ManualSlot, toSave: Program) {
    setSaveFailed(!saveStore.save(slot, toSave));
    setSlots(manualSlots.map((each) => saveStore.load(each)));
    setConfirming(null);
  }

  function describe(loaded: LoadedSave): string {
    if (loaded.kind === "empty") return "Empty";
    if (loaded.kind === "problem") return loaded.message;
    const view = simulation.readProgram(loaded.program);
    return `Turn ${view.turnNumber}, ${formatLaunchWindow(view.date)}, ${formatMoney(view.moneyMillions)}, ${view.publicSupport} Public Support`;
  }

  return (
    <section className="panel">
      <h2>
        <GameText>Save Slots</GameText>
      </h2>
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
                {program && (
                  <button
                    type="button"
                    onClick={() => {
                      if (loaded.kind === "empty") saveTo(slot, program);
                      else setConfirming({ action: "overwrite", slot });
                    }}
                  >
                    Save here
                  </button>
                )}
                {loaded.kind === "program" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmLoading) {
                        setConfirming({
                          action: "load",
                          slot,
                          program: loaded.program,
                        });
                      } else onLoad(loaded.program);
                    }}
                  >
                    Load
                  </button>
                )}
              </div>
              {program &&
                confirming?.action === "overwrite" &&
                confirming.slot === slot && (
                  <div
                    role="dialog"
                    aria-label="Confirm overwriting"
                    className="confirm"
                  >
                    <p>Overwrite what's saved in this slot?</p>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        saveTo(slot, program);
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
              {confirming?.action === "load" && confirming.slot === slot && (
                <div
                  role="dialog"
                  aria-label="Confirm loading"
                  className="confirm"
                >
                  <p>
                    <GameText>
                      Load this save? It replaces your current Program, which is
                      lost unless it's in a slot.
                    </GameText>
                  </p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setConfirming(null);
                      onLoad(confirming.program);
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
    </section>
  );
}
