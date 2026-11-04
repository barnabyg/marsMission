import { describe, expect, it } from "vitest";
import { budgetGauge } from "./budgetGauge";

describe("a budget gauge", () => {
  it("fills in proportion to how much of the limit is used", () => {
    expect(budgetGauge(1, 4).fillPercent).toBe(25);
  });

  it("is within its limit when more than 10% of it is left", () => {
    expect(budgetGauge(3.5, 4).level).toBe("within");
  });

  it("is near its limit within 10% of it", () => {
    expect(budgetGauge(3.6, 4).level).toBe("near");
  });

  it("is still near, not over, exactly at its limit", () => {
    expect(budgetGauge(4, 4).level).toBe("near");
  });

  it("is over once past its limit, with the bar full", () => {
    expect(budgetGauge(5.5, 4)).toEqual({ fillPercent: 100, level: "over" });
  });

  it("is empty and within a limit of nothing while nothing is used", () => {
    expect(budgetGauge(0, 0)).toEqual({ fillPercent: 0, level: "within" });
  });

  it("is over a limit of nothing once anything is used", () => {
    expect(budgetGauge(1, 0)).toEqual({ fillPercent: 100, level: "over" });
  });
});
