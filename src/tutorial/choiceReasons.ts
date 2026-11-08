import {
  formatMoney,
  type PlannedActivity,
  type PlannedAsset,
} from "../simulation/simulation";

/*
 * The reasons for Service Life and Activity choices, each naming the figures that Planning Mode shows beside the
 * choice, so that a player can check them without the tutorial.
 */

const daysOf = (days: number) => `${days.toLocaleString("en")} days`;

const turnsOf = (turns: number) =>
  `${String(turns)} Turn${turns === 1 ? "" : "s"}`;

/** The longest Service Life on offer for an Asset. */
const longestOf = ({ serviceLifeOptions }: PlannedAsset) =>
  serviceLifeOptions.toSorted((first, second) => second.days - first.days)[0];

/** What the longest Service Life adds, as its choice shows it: "2,800 days add 1,500 days, about 1.9 Turns". */
export function longestAdds(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  if (!longest) return "";
  return `the longest Service Life adds ${daysOf(longest.extraDays)}, about ${turnsOf(longest.extraTurns)}`;
}

/** Why the longest Service Life pays for itself for an Asset that earns, in what its choice shows. */
export function longestEarns(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  if (!longest) return "";
  return `${asset.name}'s ${daysOf(longest.days)} add ${daysOf(longest.extraDays)}, about ${turnsOf(longest.extraTurns)}, which earn ${formatMoney(longest.extraGrantMillions)} in Research Grants for ${formatMoney(longest.costMillions)}.`;
}

/** What the longest Service Life would cost, for an Asset kept to its shortest for want of money. */
export function longestCosts(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  if (!longest) return "";
  return `${asset.name}'s ${daysOf(longest.days)} would cost ${formatMoney(longest.costMillions)}.`;
}

/** Why a longer Service Life wouldn't pay for itself, in what its choice shows. */
export function longestWouldNotPay(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  if (!longest) return "";
  return `${asset.name}'s ${daysOf(longest.days)} would add ${daysOf(longest.extraDays)}, about ${turnsOf(longest.extraTurns)}, earning ${formatMoney(longest.extraGrantMillions)} in Research Grants for ${formatMoney(longest.costMillions)}.`;
}

/** That only Research Grants pay towards a longer Service Life. */
export const onlyGrantsPay =
  "Only Research Grants pay towards a longer Service Life, as Science and Public Support aren't money.";

/**
 * Why this research Activity is the one for an Asset, in what each Activity's choice shows it earns a Turn: the biggest
 * Research Grant if it pays one, or else the most Science, against the best of the others.
 */
export function bestActivityReason(
  assetName: string,
  chosen: PlannedActivity,
  activities: PlannedActivity[],
): string {
  const others = activities.filter(
    ({ id, earnsPerTurn }) => id !== chosen.id && earnsPerTurn,
  );
  const grant = (activity: PlannedActivity) =>
    activity.earnsPerTurn?.researchGrantMillions ?? 0;
  const science = (activity: PlannedActivity) =>
    activity.earnsPerTurn?.science ?? 0;
  const pays = grant(chosen) > 0;
  const measure = pays ? grant : science;
  const [best] = others.toSorted(
    (first, second) => measure(second) - measure(first),
  );
  const format = pays ? formatMoney : String;
  const against =
    best && measure(best) > 0
      ? `against ${format(measure(best))} for ${best.name}`
      : `where the others ${pays ? "pay" : "earn"} none`;
  return pays
    ? `${chosen.name} pays the biggest Research Grant of ${assetName}'s Activities: ${formatMoney(grant(chosen))} a Turn, ${against}.`
    : `${chosen.name} earns the most Science of ${assetName}'s Activities: ${String(science(chosen))} a Turn, ${against}.`;
}
