import { describe, expect, it } from "vitest";
import { confirmLabel } from "./slotChoice";

describe("the Save and Load dialogs' confirm button", () => {
  it("asks for a slot until one is chosen", () => {
    expect(confirmLabel({ kind: "save" }, null)).toBe("Choose a Save Slot");
    expect(confirmLabel({ kind: "load", replacesProgram: true }, null)).toBe(
      "Choose a Save Slot",
    );
  });

  it("saves to an empty slot without mentioning overwriting", () => {
    expect(
      confirmLabel({ kind: "save" }, { slot: 1, contents: { kind: "empty" } }),
    ).toBe("Save to Save Slot 1");
  });

  it("says a used slot's save is overwritten, and which Turn it held", () => {
    expect(
      confirmLabel(
        { kind: "save" },
        { slot: 2, contents: { kind: "program", turnNumber: 4 } },
      ),
    ).toBe("Overwrite Save Slot 2 (Turn 4)");
    expect(
      confirmLabel(
        { kind: "save" },
        { slot: 3, contents: { kind: "problem" } },
      ),
    ).toBe("Overwrite Save Slot 3");
  });

  it("names the Turn loaded, and says it replaces the current Program only when there is one to lose", () => {
    const slot = {
      slot: 1,
      contents: { kind: "program", turnNumber: 3 },
    } as const;
    expect(confirmLabel({ kind: "load", replacesProgram: true }, slot)).toBe(
      "Load Turn 3, replacing the current Program",
    );
    expect(confirmLabel({ kind: "load", replacesProgram: false }, slot)).toBe(
      "Load Turn 3",
    );
  });
});
