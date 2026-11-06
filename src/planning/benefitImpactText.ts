import {
  formatMoney,
  type BenefitImpact,
  type GrantImpact,
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
