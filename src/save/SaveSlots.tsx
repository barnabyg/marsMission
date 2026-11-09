import { useId, useState } from "react";
import {
  formatMoney,
  type Program,
  type Simulation,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { formatLaunchWindow } from "../ui/format";
import { GameText } from "../ui/GameText";
import { manualSlots, type LoadedSave, type SaveStore } from "./saveStore";
import { confirmLabel, type ManualSlot, type SlotChoice } from "./slotChoice";

export interface SaveAction {
  kind: "save";
  program: Program;
  onSaved: (slot: ManualSlot) => void;
}

export interface LoadAction {
  kind: "load";
  /** Whether loading replaces a Program in play or in the automatic save, which the confirm button then says. */
  replacesProgram: boolean;
  onLoad: (program: Program) => void;
}

/** Whether any Save Slot holds a save, which is when a screen offers loading one. */
export function anySlotUsed(saveStore: SaveStore): boolean {
  return manualSlots.some((slot) => saveStore.load(slot).kind !== "empty");
}

function useSlots(saveStore: SaveStore): LoadedSave[] {
  const [slots] = useState(() =>
    manualSlots.map((slot) => saveStore.load(slot)),
  );
  return slots;
}

function describeSlot(
  simulation: Simulation,
  loaded: LoadedSave,
  compact: boolean,
): string {
  if (loaded.kind === "empty") return "Empty";
  if (loaded.kind === "problem") return loaded.message;
  const view = simulation.readProgram(loaded.program);
  if (compact) {
    return `Turn ${view.turnNumber} · ${formatLaunchWindow(view.date)} Launch Window · ${formatMoney(view.moneyMillions)}`;
  }
  return `Turn ${view.turnNumber}, ${formatLaunchWindow(view.date)}, ${formatMoney(view.moneyMillions)}, ${view.publicSupport} Public Support`;
}

function SlotText({ loaded, text }: { loaded: LoadedSave; text: string }) {
  return (
    <span
      className={
        loaded.kind === "problem" ? "save-slot-text problem" : "save-slot-text"
      }
    >
      <GameText>{text}</GameText>
    </span>
  );
}

/** The title screen's list of the Save Slots in use, each with just its Turn, Launch Window and Money, and a Load button. */
export function UsedSaveSlots({
  simulation,
  saveStore,
  onChoose,
}: {
  simulation: Simulation;
  saveStore: SaveStore;
  onChoose: (slot: ManualSlot, program: Program) => void;
}) {
  const slots = useSlots(saveStore);
  return (
    <ul className="save-slots compact">
      {manualSlots.map((slot, index) => {
        const loaded = slots[index] ?? { kind: "empty" };
        if (loaded.kind === "empty") return null;
        return (
          <li key={slot} data-testid={`save-slot-${slot}`}>
            <div className="save-slot-row">
              <strong>
                <GameText>{`Save Slot ${slot}`}</GameText>
              </strong>
              <SlotText
                loaded={loaded}
                text={describeSlot(simulation, loaded, true)}
              />
              {loaded.kind === "program" && (
                <button
                  type="button"
                  onClick={() => {
                    onChoose(slot, loaded.program);
                  }}
                >
                  Load
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Save or Load dialog: the player picks a slot, then the one footer button saves or loads, saying what it will do.
 * Loading lists only the slots with a save as choices; saving can go to any of them.
 */
export function SaveSlotsDialog({
  simulation,
  saveStore,
  action,
  onClose,
  initialSlot = null,
}: {
  simulation: Simulation;
  saveStore: SaveStore;
  action: SaveAction | LoadAction;
  onClose: () => void;
  /** The slot already chosen as it opens, as when the title screen asks before loading. */
  initialSlot?: ManualSlot | null;
}) {
  const slots = useSlots(saveStore);
  const name = useId();
  const [selected, setSelected] = useState<ManualSlot | null>(initialSlot);
  const [saveFailed, setSaveFailed] = useState(false);

  function choiceOf(slot: ManualSlot): SlotChoice {
    const loaded = slots[manualSlots.indexOf(slot)] ?? { kind: "empty" };
    if (loaded.kind !== "program") return { slot, contents: loaded };
    const { turnNumber } = simulation.readProgram(loaded.program);
    return { slot, contents: { kind: "program", turnNumber } };
  }

  function confirm(slot: ManualSlot) {
    if (action.kind === "save") {
      if (saveStore.save(slot, action.program)) action.onSaved(slot);
      else setSaveFailed(true);
      return;
    }
    const loaded = slots[manualSlots.indexOf(slot)];
    if (loaded?.kind === "program") action.onLoad(loaded.program);
  }

  const choosable = (loaded: LoadedSave) =>
    action.kind === "save" || loaded.kind === "program";

  return (
    <Dialog
      title={
        action.kind === "save" ? "Save to a Save Slot" : "Load from a Save Slot"
      }
      cancelLabel="Cancel"
      onClose={onClose}
      actions={
        <button
          type="button"
          className="primary"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) confirm(selected);
          }}
        >
          {confirmLabel(
            action.kind === "save"
              ? action
              : { kind: "load", replacesProgram: action.replacesProgram },
            selected === null ? null : choiceOf(selected),
          )}
        </button>
      }
    >
      {saveFailed && (
        <p className="problem" role="alert">
          The browser wouldn't store that save.
        </p>
      )}
      <ul className="save-slots" role="radiogroup" aria-label="Save Slots">
        {manualSlots.map((slot, index) => {
          const loaded = slots[index] ?? { kind: "empty" };
          const text = describeSlot(simulation, loaded, false);
          return (
            <li key={slot} data-testid={`save-slot-${slot}`}>
              {choosable(loaded) ? (
                <label className="save-slot-row choosable">
                  <input
                    type="radio"
                    name={name}
                    checked={selected === slot}
                    onChange={() => {
                      setSelected(slot);
                      setSaveFailed(false);
                    }}
                  />
                  <strong>{slot}</strong>
                  <SlotText loaded={loaded} text={text} />
                </label>
              ) : (
                <div className="save-slot-row">
                  <span className="save-slot-no-choice" />
                  <strong>{slot}</strong>
                  <SlotText loaded={loaded} text={text} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {action.kind === "load" &&
        action.replacesProgram &&
        selected !== null && (
          <p className="save-slots-warning">
            <GameText>
              Loading replaces your current Program, which is lost unless it's
              in a slot.
            </GameText>
          </p>
        )}
    </Dialog>
  );
}
