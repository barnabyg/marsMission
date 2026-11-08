import {
  activityEarnings,
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

/** A measure of what an Activity earns a Turn, and how a reason claims the lead on it. */
interface Measure {
  of: (activity: PlannedActivity) => number;
  format: (value: number) => string;
  leads: string;
  none: string;
}

const measures: Measure[] = [
  {
    of: ({ earnsPerTurn }) => earnsPerTurn?.researchGrantMillions ?? 0,
    format: formatMoney,
    leads: "pays the biggest Research Grant",
    none: "pay none",
  },
  {
    of: ({ earnsPerTurn }) => earnsPerTurn?.science ?? 0,
    format: String,
    leads: "earns the most Science",
    none: "earn none",
  },
  {
    of: ({ earnsPerTurn }) => earnsPerTurn?.publicSupport ?? 0,
    format: String,
    leads: "earns the most Public Support",
    none: "earn none",
  },
];

/**
 * Why this Activity is the one for an Asset, in what each Activity's choice shows it earns a Turn: the first of
 * Research Grant, Science and Public Support on which it earns more than any other, against the best of the others.
 * One that leads on none of them says only what it earns or collects.
 */
export function bestActivityReason(
  assetName: string,
  chosen: PlannedActivity,
  activities: PlannedActivity[],
): string {
  const others = activities.filter(({ id }) => id !== chosen.id);
  const lead = measures.find(
    ({ of }) =>
      of(chosen) > 0 && others.every((other) => of(other) < of(chosen)),
  );
  if (!lead) return `${chosen.name} ${activityEarnings(chosen)}.`;
  const { of, format, leads, none } = lead;
  const [best] = others.toSorted((first, second) => of(second) - of(first));
  const against =
    best && of(best) > 0
      ? `against ${format(of(best))} for ${best.name}`
      : `where the others ${none}`;
  return `${chosen.name} ${leads} of ${assetName}'s Activities: ${format(of(chosen))} a Turn, ${against}.`;
}
