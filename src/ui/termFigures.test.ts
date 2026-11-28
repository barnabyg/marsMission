import { describe, expect, it } from "vitest";
import { testCatalogue } from "../simulation/testCatalogue";
import { definitionOf, termFigures } from "./termFigures";
import { tooltips } from "./tooltips";

function withBaseFunding(
  millionsPerPublicSupport: number,
  mostMillions: number,
) {
  const catalogue = testCatalogue();
  return {
    ...catalogue,
    program: {
      ...catalogue.program,
      baseFunding: { millionsPerPublicSupport, mostMillions },
    },
  };
}

describe("termFigures", () => {
  it("gives Base funding's rate and most from the Catalogue", () => {
    expect(termFigures(withBaseFunding(2, 250))["Base funding"]).toBe(
      "It pays $2M for each point of Public Support, at most $250M a Turn.",
    );
  });

  it("gives Base funding no figures when the Catalogue has none", () => {
    expect(termFigures(testCatalogue())["Base funding"]).toBeUndefined();
  });
});

describe("definitionOf", () => {
  it("adds a term's figures after what it means, and leaves a term without any as it is", () => {
    const figures = termFigures(withBaseFunding(2, 250));
    expect(definitionOf("Base funding", figures)).toBe(
      `${tooltips["Base funding"]} It pays $2M for each point of Public Support, at most $250M a Turn.`,
    );
    expect(definitionOf("Science", figures)).toBe(tooltips.Science);
  });
});
