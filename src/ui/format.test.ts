import { describe, expect, it } from "vitest";
import { exactMoneyTooltip, formatChange, formatRoundedMoney } from "./format";

describe("a change as shown", () => {
  it("has a plus sign when the value went up", () => {
    expect(formatChange(155)).toBe("+155");
  });

  it("has a minus sign when the value went down", () => {
    expect(formatChange(-15)).toBe("−15");
  });

  it("is in money for Money", () => {
    expect(formatChange(-1250, "money")).toBe("−$1.25B");
    expect(formatChange(80, "money")).toBe("+$80M");
  });
});

describe("a running total of money as the status bar shows it", () => {
  it("is rounded to three significant figures", () => {
    expect(formatRoundedMoney(8915)).toBe("$8.92B");
    expect(formatRoundedMoney(19915)).toBe("$19.9B");
    expect(formatRoundedMoney(2437)).toBe("$2.44B");
    expect(formatRoundedMoney(1234)).toBe("$1.23B");
  });

  it("is unchanged when it has three significant figures or fewer", () => {
    expect(formatRoundedMoney(2300)).toBe("$2.3B");
    expect(formatRoundedMoney(535)).toBe("$535M");
    expect(formatRoundedMoney(0)).toBe("$0M");
  });

  it("moves up to billions when rounding reaches a thousand millions", () => {
    expect(formatRoundedMoney(999.6)).toBe("$1B");
  });

  it("keeps its sign when negative", () => {
    expect(formatRoundedMoney(-8915)).toBe("-$8.92B");
  });
});

describe("the exact figure behind a rounded one", () => {
  it("is given for a tooltip when rounding changed it", () => {
    expect(exactMoneyTooltip(8915)).toBe("Exactly $8.915B");
  });

  it("is not given when rounding changed nothing", () => {
    expect(exactMoneyTooltip(2300)).toBeUndefined();
  });
});
