import {
  formatMoney,
  formatPropellant,
  type BenefitImpact,
  type GrantImpact,
  type ProgramView,
} from "../simulation/simulation";

/** "2 Assets and 3 Crew", leaving out whichever there are none of. */
function raisedOf({
  assets,
  crew,
}: Pick<BenefitImpact, "assets" | "crew">): string {
  return [
    assets > 0 && `${String(assets)} ${assets === 1 ? "Asset" : "Assets"}`,
    crew > 0 && `${String(crew)} Crew`,
  ]
    .filter(Boolean)
    .join(" and ");
}

/** What an Asset's Benefit would add this Turn, as its Benefit tag explains it after what the Benefit does. */
export function describeBenefitImpact(impact: BenefitImpact): string {
  if (impact.alreadyGivenBy.length > 0)
    return `It adds nothing this Turn, as ${impact.alreadyGivenBy.join(" and ")} at Mars already gives this Benefit.`;
  if (impact.assets + impact.crew === 0)
    return "It adds nothing this Turn, as nothing on the surface is doing research. It pays once Assets or Crew are.";
  return `This Turn it would raise the research of the ${raisedOf(impact)} on the surface, adding about ${String(impact.extraScience)} Science over a whole Turn.`;
}

/** What a Mars lab's Benefit would add this Turn, as its Benefit tag explains it after what the Benefit does. */
export function describeGrantImpact(impact: GrantImpact): string {
  const site = impact.landingSiteName;
  if (site === null)
    return "It adds nothing this Turn, as nothing it raises at a Landing Site is earning a Research Grant. It pays once landed beside them.";
  if (impact.alreadyGivenBy.length > 0)
    return `It adds nothing this Turn at ${site}, the best place for it, as ${impact.alreadyGivenBy.join(" and ")} there already gives this Benefit.`;
  return `Landed at ${site} this Turn, it would raise the Research Grants of the ${raisedOf(impact)} there, adding about ${formatMoney(impact.extraGrantMillions)} over a whole Turn.`;
}

type BenefitFacts = Pick<
  ProgramView["assets"][number],
  "name" | "benefit" | "benefitImpact" | "grantImpact" | "makes" | "habitat"
>;

/**
 * What an Asset's Benefit would add this Turn, or why nothing, for the Benefits that depend on what is at Mars as the
 * Turn starts: raising research on the surface, or Research Grants at a Landing Site. Null for a Benefit that doesn't
 * depend on it, such as what a fuel plant makes, or for an Asset with none.
 */
export function benefitThisTurn({
  benefit,
  benefitImpact,
  grantImpact,
}: BenefitFacts): string | null {
  if (!benefit) return null;
  if (benefitImpact) return describeBenefitImpact(benefitImpact);
  if (grantImpact) return describeGrantImpact(grantImpact);
  return null;
}

/**
 * An Asset card's Benefit tag: the figure its Benefit would add, with what the Benefit does and why that much in its
 * tooltip. A Benefit that would add nothing this Turn has no tag, as "+0" reads like a fault: the Asset's details say
 * why instead.
 */
export function benefitTag(
  asset: BenefitFacts,
): { text: string; detail: string } | null {
  const { name, benefit, benefitImpact, grantImpact, makes, habitat } = asset;
  if (!benefit) return null;
  const detail = (why: string) => `${name}: ${benefit} ${why}`;
  const thisTurn = benefitThisTurn(asset);
  if (thisTurn !== null) {
    const added = benefitImpact
      ? benefitImpact.extraScience > 0 &&
        `+${String(benefitImpact.extraScience)} Science`
      : grantImpact &&
        grantImpact.extraGrantMillions > 0 &&
        `+${formatMoney(grantImpact.extraGrantMillions)}`;
    return added
      ? { text: `Benefit ${added}`, detail: detail(thisTurn) }
      : null;
  }
  if (makes) {
    const made = formatPropellant(makes.ascentPropellantKgPerTurn);
    return {
      text: `Benefit +${made} propellant`,
      detail: detail(`Over a whole Turn at Mars it makes ${made}.`),
    };
  }
  if (habitat) {
    const days = habitat.extraDays.toLocaleString("en");
    return {
      text: `Benefit +${days} days`,
      detail: detail(
        `A Crew member landing beside it with full Health and no Protection would last about ${days} more days at Mars before their Health runs out.`,
      ),
    };
  }
  return null;
}
