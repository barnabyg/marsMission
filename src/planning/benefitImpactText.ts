import type { BenefitImpact } from "../simulation/simulation";

/** "2 Assets and 3 Crew", leaving out whichever there are none of. */
function raisedOf({ assets, crew }: BenefitImpact): string {
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
