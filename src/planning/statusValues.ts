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
