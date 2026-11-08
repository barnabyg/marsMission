import {
  formatDays,
  formatMoney,
  formatTurns,
  paysForItself,
  serviceLifeGain,
  type PlannedActivity,
  type PlannedAsset,
} from "../simulation/simulation";

/*
 * The reasons for Service Life and Activity choices, each naming the figures that Planning Mode shows beside the
 * choice, so that a player can check them without the tutorial.
 */

/** The longest Service Life on offer for an Asset, which always has at least one. */
const longestOf = ({ serviceLifeOptions }: PlannedAsset) =>
  serviceLifeOptions.reduce((longest, option) =>
    option.days > longest.days ? option : longest,
  );

/**
 * Whether the longest Service Life pays for itself, with the figures its choice shows: "Trailblazer Rover's longest
 * Service Life, 2,800 days, pays for itself: +1,500 days (about 1.9 Turns) earn $1.54B in Research Grants against
 * $300M and $30M Upkeep."
 */
export function longestPays(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  return `${asset.name}'s longest Service Life, ${formatDays(longest.days)}, ${paysForItself(longest) ? "pays" : "wouldn't pay"} for itself: ${serviceLifeGain(longest)}.`;
}

/** What the longest Service Life adds to a part of the Base: "Curie Station's 3,600 days add 1,500 days (about 1.9 Turns)". */
export function longestAdds(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  return `${asset.name}'s ${formatDays(longest.days)} add ${formatDays(longest.extraDays)} (about ${formatTurns(longest.extraTurns)})`;
}

/** What the longest Service Life would cost, for an Asset kept to its shortest for want of money. */
export function longestCosts(asset: PlannedAsset): string {
  const longest = longestOf(asset);
  return `${asset.name}'s longest Service Life, ${formatDays(longest.days)}, would cost ${formatMoney(longest.costMillions)}.`;
}

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
