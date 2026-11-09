import { describe, expect, it } from "vitest";
import { cardSpans } from "./summaryGrid";

const cards = (...wide: boolean[]) => wide.map((each) => ({ wide: each }));

describe("cardSpans", () => {
  it("gives nothing for no cards", () => {
    expect(cardSpans([])).toEqual([]);
  });

  it("lets a card alone in its row span every column", () => {
    expect(cardSpans(cards(false))).toEqual([3]);
    expect(cardSpans(cards(false, false, false, false))).toEqual([1, 1, 1, 3]);
  });

  it("lets the last of two in a row fill the column left over", () => {
    expect(cardSpans(cards(false, false))).toEqual([1, 2]);
    expect(cardSpans(cards(false, false, false, false, false))).toEqual([
      1, 1, 1, 1, 2,
    ]);
  });

  it("leaves a full row as it is", () => {
    expect(cardSpans(cards(false, false, false))).toEqual([1, 1, 1]);
  });

  it("gives a wide card a row of its own, filling the row before it", () => {
    expect(cardSpans(cards(true, false, false, false))).toEqual([3, 1, 1, 1]);
    expect(cardSpans(cards(false, true, false))).toEqual([3, 3, 3]);
    expect(cardSpans(cards(false, false, true, false, false, false))).toEqual([
      1, 2, 3, 1, 1, 1,
    ]);
  });
});
