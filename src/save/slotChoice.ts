import type { manualSlots } from "./saveStore";

export type ManualSlot = (typeof manualSlots)[number];

/** A slot the player has picked in the Save or Load dialog, and what it holds. */
export interface SlotChoice {
  slot: ManualSlot;
  contents:
    | { kind: "empty" }
    | { kind: "problem" }
    | { kind: "program"; turnNumber: number };
}

/** What the dialog's confirm button says, so that one click does just what it says. */
export function confirmLabel(
  action: { kind: "save" } | { kind: "load"; replacesProgram: boolean },
  choice: SlotChoice | null,
): string {
  if (choice === null) return "Choose a Save Slot";
  const { slot, contents } = choice;
  if (action.kind === "save") {
    if (contents.kind === "empty") return `Save to Save Slot ${slot}`;
    if (contents.kind === "problem") return `Overwrite Save Slot ${slot}`;
    return `Overwrite Save Slot ${slot} (Turn ${contents.turnNumber})`;
  }
  const turn =
    contents.kind === "program"
      ? `Turn ${contents.turnNumber}`
      : `Save Slot ${slot}`;
  return action.replacesProgram
    ? `Load ${turn}, replacing the current Program`
    : `Load ${turn}`;
}
