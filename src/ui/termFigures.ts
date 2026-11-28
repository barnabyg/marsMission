import type { Catalogue } from "../catalogue/catalogue";
import { formatMoney } from "../simulation/simulation";
import { tooltips, type Term } from "./tooltips";

/**
 * Sentences with the Catalogue's figures that follow a term's definition in its tooltip and the Glossary, such as
 * what Base funding pays. The definitions themselves name no figures, as tuning would make them wrong (ADR 0003).
 */
export type TermFigures = Partial<Record<Term, string>>;

export function termFigures(catalogue: Catalogue): TermFigures {
  const { baseFunding } = catalogue.program;
  const reliability = reliabilityFigures(catalogue.reliabilityLevels);
  return {
    ...(baseFunding && {
      "Base funding": `It pays ${formatMoney(baseFunding.millionsPerPublicSupport)} for each point of Public Support, rounded down to tens of millions, at most ${formatMoney(baseFunding.mostMillions)} a Turn.`,
    }),
    ...(reliability && { Reliability: reliability }),
  };
}

/**
 * How much of the chance of failing each Reliability level leaves, such as "Tested leaves 50% of the chance of failing,
 * and Redundant 20%.", leaving out a level that changes nothing.
 */
function reliabilityFigures(
  levels: Catalogue["reliabilityLevels"],
): string | undefined {
  const parts = levels
    .filter(({ failureMultiplier }) => failureMultiplier < 1)
    .map(
      ({ name, failureMultiplier }, index) =>
        `${name} ${index === 0 ? "leaves " : ""}${String(Math.round(failureMultiplier * 100))}%${index === 0 ? " of the chance of failing" : ""}`,
    );
  const last = parts.pop();
  if (last === undefined) return undefined;
  return parts.length > 0 ? `${parts.join(", ")}, and ${last}.` : `${last}.`;
}

/** What a term means, as its tooltip and the Glossary give it: its definition, then any figures the Catalogue adds. */
export function definitionOf(term: Term, figures: TermFigures): string {
  const added = figures[term];
  return added ? `${tooltips[term]} ${added}` : tooltips[term];
}
