import { formatMoney } from "../simulation/simulation";
import { exactMoneyTooltip, formatRoundedMoney } from "../ui/format";
import { budgetGauge, type BudgetGauge } from "./budgetGauge";

/** How far above the Cancellation Level, as a share of it, Public Support has to be before the gauge stops warning. */
const warningMargin = 0.5;
/** The gauge runs up to at least this many times the Cancellation Level, so the level sits low on it when all is well. */
const shortestGauge = 3;

/** What the gauge of Public Support against the Cancellation Level shows. */
export interface PublicSupportGauge {
  /** Whether Public Support is close enough to the Cancellation Level to warn about. */
  warning: boolean;
  /** How far along the gauge Public Support reaches, from 0 to 100. */
  fillPercent: number;
  /** Where on the gauge the Cancellation Level sits, from 0 to 100. */
  levelPercent: number;
}

export function publicSupportGauge(
  publicSupport: number,
  cancellationLevel: number,
): PublicSupportGauge {
  const top = Math.max(cancellationLevel * shortestGauge, publicSupport);
  return {
    warning: publicSupport < cancellationLevel * (1 + warningMargin),
    fillPercent: (Math.max(publicSupport, 0) / top) * 100,
    levelPercent: (cancellationLevel / top) * 100,
  };
}

/** What this Turn will spend and what that leaves, as the muted line under the Money shows them. */
export interface TurnSpend {
  /** What the choices so far will spend, such as "−$1.4B", or "$0M" with nothing chosen. */
  spent: string;
  /** What that leaves, such as "$900M left", or by how much it goes over the Money, such as "$50M over". */
  rest: string;
  /** How close the spend is to the Money, as the budget bar's cost gauge judges it. */
  level: BudgetGauge["level"];
}

export function turnSpend(
  spendMillions: number,
  moneyMillions: number,
): TurnSpend {
  const leftMillions = moneyMillions - spendMillions;
  return {
    spent:
      spendMillions > 0
        ? `−${formatRoundedMoney(spendMillions)}`
        : formatRoundedMoney(0),
    rest:
      leftMillions < 0
        ? `${formatRoundedMoney(-leftMillions)} over`
        : `${formatRoundedMoney(leftMillions)} left`,
    level: budgetGauge(spendMillions, moneyMillions).level,
  };
}

/**
 * What the Money's tooltip adds after what Base funding is: how much comes in as the Turn ends, and the exact Money when
 * the status bar shows it rounded. Nothing when neither applies.
 */
export function moneyDetail(
  moneyMillions: number,
  baseFundingMillions: number,
): string | undefined {
  const exact = exactMoneyTooltip(moneyMillions);
  const parts = [
    baseFundingMillions > 0 &&
      `+${formatMoney(baseFundingMillions)} comes in as this Turn ends.`,
    exact && `${exact}.`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** The values in the status bar that can change from one Turn to the next by an amount. */
export interface StatusValues {
  moneyMillions: number;
  publicSupport: number;
  science: number;
  cancellationLevel: number;
}

const statusKeys: (keyof StatusValues)[] = [
  "moneyMillions",
  "publicSupport",
  "science",
  "cancellationLevel",
];

export type StatusChanges = Partial<Record<keyof StatusValues, number>>;

/** How much each value changed since the start of the last Turn, leaving out those that didn't, and none with no last Turn. */
export function changesSinceLastTurn(
  lastTurn: StatusValues | null,
  now: StatusValues,
): StatusChanges {
  if (!lastTurn) return {};
  const changes: StatusChanges = {};
  for (const key of statusKeys) {
    const change = now[key] - lastTurn[key];
    if (change !== 0) changes[key] = change;
  }
  return changes;
}
