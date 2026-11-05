import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { setup, skipTurn } from "./testHelpers";

/** The Test Catalogue with base funding of 2 for each point of Public Support, up to 300 a Turn. */
function withBaseFunding() {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      program: {
        ...files.program,
        baseFunding: { millionsPerPublicSupport: 2, mostMillions: 300 },
      },
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

describe("base funding", () => {
  it("pays nothing when the data files give none", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).baseFundingMillions).toBe(0);
    expect(
      simulation.runTurn(program, skipTurn).summary.baseFundingMillions,
    ).toBe(0);
  });

  it("pays as the Turn ends for the Public Support it started with, which Planning Mode shows beforehand", () => {
    const { simulation, program } = withBaseFunding();
    const atStart = { ...program, publicSupport: 120 };
    expect(simulation.readProgram(atStart).baseFundingMillions).toBe(240);
    const { summary } = simulation.runTurn(atStart, skipTurn);
    expect(summary.baseFundingMillions).toBe(240);
    expect(summary.moneyEndMillions).toBe(summary.moneyStartMillions + 240);
  });

  it("rounds down to whole tens of millions, and pays no more than its most", () => {
    const { simulation, program } = withBaseFunding();
    const read = (publicSupport: number) =>
      simulation.readProgram({ ...program, publicSupport }).baseFundingMillions;
    expect(read(104)).toBe(200);
    expect(read(149)).toBe(290);
    expect(read(151)).toBe(300);
    expect(read(900)).toBe(300);
    expect(read(0)).toBe(0);
  });
});
