/** How close a budget is to its limit: comfortably within it, near it, or over it. */
type BudgetLevel = "within" | "near" | "over";

/** How much of its limit a budget uses before its gauge warns that it is near: within 10% of the limit. */
const nearShare = 0.9;

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
    // A Mission at exactly its limit is still near it, not over.
    level: used >= limit * nearShare ? "near" : "within",
  };
}
