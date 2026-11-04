/** How close a budget is to its limit: comfortably within it, near it, or over it. */
type BudgetLevel = "within" | "near" | "over";

export interface BudgetGauge {
  /** How full the bar is, from 0 to 100. */
  fillPercent: number;
  level: BudgetLevel;
}

/** A filling bar for how much of a limit is used, such as a Mission's mass against its Launch Vehicle's capacity. */
export function budgetGauge(used: number, limit: number): BudgetGauge {
  if (used > limit) return { fillPercent: 100, level: "over" };
  if (used <= 0) return { fillPercent: 0, level: "within" };
  return {
    fillPercent: (used / limit) * 100,
    // Within 10% of the limit, which a Mission at exactly its limit still is.
    level: used >= limit * 0.9 ? "near" : "within",
  };
}
