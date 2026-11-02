import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";

type Benefit = NonNullable<Catalogue["assets"][number]["benefit"]>;

/** A stretch of a Turn's days, raised by this percentage, which is 0 if nothing raises it, by the Assets named. */
export interface Stretch {
  fromDay: number;
  toDay: number;
  percent: number;
  givenBy: string[];
}

/** The Benefit an Asset gives, if its design gives one. */
function benefitOf(catalogue: Catalogue, assetId: string): Benefit | undefined {
  return catalogue.assets.find(({ id }) => id === assetId)?.benefit;
}

/**
 * The stretches of the Turn on which Assets operating at Mars raise this, each from the day one starts operating to
 * the day one stops. Benefits that raise the same thing don't add up, so each stretch has the largest percentage
 * given on its days, and the Assets that give that much.
 */
export function raisedStretches(
  catalogue: Catalogue,
  inService: AssetInService[],
  raises: Benefit["raises"],
): Stretch[] {
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const givers = inService.flatMap(({ asset, fromDay, untilDay }) => {
    const toDay = untilDay ?? turnDays;
    const gives = benefitOf(catalogue, asset.assetId)?.raises === raises;
    return gives && toDay > fromDay ? [{ ...asset, fromDay, toDay }] : [];
  });
  const days = [
    ...new Set(givers.flatMap(({ fromDay, toDay }) => [fromDay, toDay])),
  ].toSorted((first, second) => first - second);
  return days.slice(1).flatMap((toDay, index) => {
    const fromDay = days[index] ?? toDay;
    const raise = largestRaise(
      catalogue,
      givers.filter(
        (giver) => giver.fromDay <= fromDay && giver.toDay >= toDay,
      ),
      raises,
    );
    return raise ? [{ fromDay, toDay, ...raise }] : [];
  });
}

/** These days split where the raised stretches start and stop, in order, each with what raises it, if anything. */
export function splitByRaise(
  fromDay: number,
  toDay: number,
  raised: Stretch[],
): Stretch[] {
  const cuts = [
    ...new Set([
      fromDay,
      toDay,
      ...raised
        .flatMap((stretch) => [stretch.fromDay, stretch.toDay])
        .filter((day) => day > fromDay && day < toDay),
    ]),
  ].toSorted((first, second) => first - second);
  return cuts.slice(1).map((to, index) => {
    const from = cuts[index] ?? to;
    const raise = raised.find(
      (stretch) => stretch.fromDay <= from && stretch.toDay >= to,
    );
    return {
      fromDay: from,
      toDay: to,
      percent: raise?.percent ?? 0,
      givenBy: raise?.givenBy ?? [],
    };
  });
}

/** How much a Benefit raises something, and the Assets that give it. */
export interface Raise {
  percent: number;
  givenBy: string[];
}

/** The largest raise to this that these Assets give, which is what applies, or null if none of them raises it. */
export function largestRaise(
  catalogue: Catalogue,
  givers: { assetId: string; name: string }[],
  raises: Benefit["raises"],
): Raise | null {
  const giving = givers.flatMap(({ assetId, name }) => {
    const benefit = benefitOf(catalogue, assetId);
    return benefit?.raises === raises
      ? [{ name, percent: benefit.percent }]
      : [];
  });
  const percent = Math.max(0, ...giving.map((giver) => giver.percent));
  if (percent === 0) return null;
  const givenBy = giving
    .filter((giver) => giver.percent === percent)
    .map(({ name }) => name);
  return { percent, givenBy: [...new Set(givenBy)] };
}

/** What a Benefit does, as Planning Mode describes it. */
export function describeBenefit({ raises, percent }: Benefit): string {
  const what: Record<Benefit["raises"], string> = {
    surfaceResearch: "the Ongoing Research of every Asset on the surface",
  };
  return `Raises ${what[raises]} by ${percent}% on each day it operates at Mars, whatever its Activity. A second one adds nothing.`;
}
