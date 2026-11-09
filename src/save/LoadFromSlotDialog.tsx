import type { Simulation } from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { SaveSlots, type LoadAction } from "./SaveSlots";
import { manualSlots, type SaveStore } from "./saveStore";

/** Whether any Save Slot holds a save, which is when a screen offers Load…. */
export function anySlotUsed(saveStore: SaveStore): boolean {
  return manualSlots.some((slot) => saveStore.load(slot).kind !== "empty");
}

/** The dialog that Load… opens, from the title screen or the Program summary. */
export function LoadFromSlotDialog({
  simulation,
  saveStore,
  action,
  onClose,
}: {
  simulation: Simulation;
  saveStore: SaveStore;
  action: LoadAction;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Load from a Save Slot"
      cancelLabel="Cancel"
      onClose={onClose}
    >
      <SaveSlots
        simulation={simulation}
        saveStore={saveStore}
        action={action}
      />
    </Dialog>
  );
}
