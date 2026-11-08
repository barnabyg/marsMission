import type { PlannedServiceLife } from "./previews";
import { formatDays, formatMoney, formatTurns } from "./rules";

/*
 * How Planning Mode and the tutorial word what a longer Service Life adds, in one place so that the tutorial quotes
 * exactly what the choices show.
 */

/** Whether the Research Grants a longer Service Life would earn cover its cost and the Upkeep of its extra Turns. */
export const paysForItself = ({
  costMillions,
  extraGrantMillions,
  extraUpkeepMillions,
}: PlannedServiceLife) =>
  extraGrantMillions >= costMillions + extraUpkeepMillions;

/**
 * What a longer Service Life adds, against what it costs: "+1,500 days (about 1.9 Turns) earn $1.54B in Research
 * Grants against $300M and $30M Upkeep".
 */
export function serviceLifeGain({
  costMillions,
  extraDays,
  extraTurns,
  extraGrantMillions,
  extraUpkeepMillions,
}: PlannedServiceLife): string {
  const upkeep =
    extraUpkeepMillions > 0
      ? ` and ${formatMoney(extraUpkeepMillions)} Upkeep`
      : "";
  return `+${formatDays(extraDays)} (about ${formatTurns(extraTurns)}) earn ${formatMoney(extraGrantMillions)} in Research Grants against ${formatMoney(costMillions)}${upkeep}`;
}

/** That only Research Grants pay for a longer Service Life. */
export const onlyGrantsPay =
  "Only Research Grants pay towards a longer Service Life and its Upkeep, as Science and Public Support aren't money.";
