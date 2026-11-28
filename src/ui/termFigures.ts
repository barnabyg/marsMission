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
  return baseFunding
    ? {
        "Base funding": `It pays ${formatMoney(baseFunding.millionsPerPublicSupport)} for each point of Public Support, rounded down to tens of millions, at most ${formatMoney(baseFunding.mostMillions)} a Turn.`,
      }
    : {};
}

/** What a term means, as its tooltip and the Glossary give it: its definition, then any figures the Catalogue adds. */
export function definitionOf(term: Term, figures: TermFigures): string {
  const added = figures[term];
  return added ? `${tooltips[term]} ${added}` : tooltips[term];
}
