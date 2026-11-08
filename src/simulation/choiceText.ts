import type { PlannedActivity, PlannedServiceLife } from "./previews";
import { formatDays, formatMoney, formatTurns } from "./rules";

/*
 * How Planning Mode and the tutorial word what an Activity earns and what a longer Service Life adds, in one place so
 * that the tutorial quotes exactly what the choices show.
 */

/**
 * What an Activity earns over a whole Turn, leaving out what it earns none of: "earns 80 Science and $800M Research
 * Grant a Turn", or "collects 10 samples a Turn". One that isn't research says what it does instead: a Survey "lowers
 * the landing risk of later landings", and any other its description, which starts with a verb so that it reads on
 * after the Activity's name: "stays in place and does no work this Turn".
 */
export function whatActivityDoes({
  surveys,
  description,
  earnsPerTurn,
  cachesPerTurn,
}: PlannedActivity): string {
  // A Survey's description is too long for a line under its choice, so it says what it does for every later landing.
  if (surveys) return "lowers the landing risk of later landings";
  if (cachesPerTurn) {
    return `collects ${String(cachesPerTurn.samples)} samples a Turn`;
  }
  if (!earnsPerTurn) {
    return `${description.charAt(0).toLowerCase()}${description.slice(1).replace(/\.$/, "")}`;
  }
  const { science, publicSupport, researchGrantMillions } = earnsPerTurn;
  const parts = [
    ...(science > 0 ? [`${String(science)} Science`] : []),
    ...(publicSupport > 0 ? [`${String(publicSupport)} Public Support`] : []),
    ...(researchGrantMillions > 0
      ? [`${formatMoney(researchGrantMillions)} Research Grant`]
      : []),
  ];
  if (parts.length === 0) return "earns nothing";
  const listed =
    parts.length === 1
      ? parts.join("")
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
  return `earns ${listed} a Turn`;
}

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
