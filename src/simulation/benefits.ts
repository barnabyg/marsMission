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

/** Who earns research whose Research Grant a Mars lab can raise: an Asset of a kind, or the Crew. */
export type GrantEarner = { assetKind: string } | "crew";

type LabBenefit = Extract<Benefit, { raises: "siteResearchGrants" }>;

/** The Benefit an Asset gives if it is a Mars lab, raising Research Grants at its Landing Site. */
export function labBenefitOf(
  catalogue: Catalogue,
  assetId: string,
): LabBenefit | undefined {
  const benefit = benefitOf(catalogue, assetId);
  return benefit?.raises === "siteResearchGrants" ? benefit : undefined;
}

/** Whether a Mars lab's Benefit raises the Research Grants of this earner. */
export const raisesGrantsFor = (
  benefit: LabBenefit | undefined,
  earner: GrantEarner,
): boolean =>
  benefit !== undefined &&
  (earner === "crew"
    ? benefit.crew
    : benefit.assetKinds.includes(earner.assetKind));

/**
 * The stretches of the Turn on which Mars labs operating at this Landing Site raise the Research Grants of this
 * earner there, each with the largest percentage given on its days, as Benefits that raise the same thing don't add
 * up. There are none away from a Landing Site.
 */
export function grantRaisedStretches(
  catalogue: Catalogue,
  inService: AssetInService[],
  landingSiteId: string | null,
  earner: GrantEarner,
): Stretch[] {
  if (landingSiteId === null) return [];
  const labs = inService.filter(
    ({ asset }) =>
      asset.landingSiteId === landingSiteId &&
      raisesGrantsFor(labBenefitOf(catalogue, asset.assetId), earner),
  );
  return raisedStretches(catalogue, labs, "siteResearchGrants");
}

/** "rovers and Crew": the kinds of Asset, and the Crew if any, whose Research Grants a Benefit raises. */
function grantsRaisedFor(assetKinds: string[], crew: boolean): string {
  const raised = [
    ...assetKinds.map((kind) => `${kind.replaceAll("-", " ")}s`),
    ...(crew ? ["Crew"] : []),
  ];
  return raised.length > 1
    ? `${raised.slice(0, -1).join(", ")} and ${raised.at(-1) ?? ""}`
    : raised.join("");
}

/** What a Benefit does, as Planning Mode describes it. */
export function describeBenefit(benefit: Benefit): string {
  if (benefit.raises === "siteResearchGrants") {
    return `Raises the Research Grants of the ${grantsRaisedFor(benefit.assetKinds, benefit.crew)} at its Landing Site by ${benefit.percent}% on each day it operates there, whatever its Activity. A second one there adds nothing.`;
  }
  return `Raises the Ongoing Research of every Asset and Crew on the surface by ${benefit.percent}% on each day it operates at Mars, whatever its Activity. A second one adds nothing.`;
}
