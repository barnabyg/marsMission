import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, skipTurn } from "./testHelpers";

/** A Program with the Test Orbiter operating at Mars, which costs 30 a Turn to keep going. */
function withOrbiterAtMars() {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) =>
        asset.id === "test-orbiter"
          ? { ...asset, upkeepMillionsPerTurn: 30 }
          : asset,
      ),
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: 0,
      })),
    }),
  );
  const program = simulation.runTurn(
    simulation.startProgram(42),
    sendOrbiter,
  ).program;
  const key = simulation.readProgram(program).operatingAssets[0]?.key ?? "";
  return { simulation, program, key };
}

const ending = (key: string): TurnPlan => ({
  mission: null,
  endedAssetKeys: [key],
});

describe("upkeep of the Assets at Mars", () => {
  it("costs nothing on the Turn an Asset launches", () => {
    const { simulation } = withOrbiterAtMars();
    const program = simulation.startProgram(42);
    expect(simulation.validatePlan(program, sendOrbiter).upkeepMillions).toBe(
      0,
    );
    expect(
      simulation.runTurn(program, sendOrbiter).summary.upkeepMillions,
    ).toBe(0);
  });

  it("charges each Asset kept operating for the Turn, and shows it to the player", () => {
    const { simulation, program } = withOrbiterAtMars();
    expect(simulation.readProgram(program).operatingAssets).toMatchObject([
      { upkeepMillions: 30 },
    ]);
    expect(simulation.validatePlan(program, skipTurn).upkeepMillions).toBe(30);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(summary.upkeepMillions).toBe(30);
    expect(
      summary.moneyStartMillions -
        summary.upkeepMillions +
        summary.researchGrantMillions,
    ).toBe(summary.moneyEndMillions);
  });

  it("stops once the player ends an Asset's mission, which leaves service as the Turn starts", () => {
    const { simulation, program, key } = withOrbiterAtMars();
    const check = simulation.validatePlan(program, ending(key));
    expect(check).toMatchObject({ upkeepMillions: 0, problems: [] });
    const { program: next, summary } = simulation.runTurn(program, ending(key));
    expect(summary.upkeepMillions).toBe(0);
    expect(summary.researchGrantMillions).toBe(0);
    expect(simulation.readProgram(next).operatingAssets).toEqual([]);
  });

  it("refuses to end an Asset that isn't operating, or the same one twice", () => {
    const { simulation, program, key } = withOrbiterAtMars();
    expect(
      simulation.validatePlan(program, ending("nothing:2030-01-01")).problems,
    ).toEqual(['There is no operating Asset called "nothing:2030-01-01".']);
    expect(
      simulation.validatePlan(program, {
        mission: null,
        endedAssetKeys: [key, key],
      }).problems,
    ).toEqual(["A plan can't end the same Asset's mission twice."]);
  });

  it("won't let a Turn pass while the upkeep can't be paid, until enough missions end", () => {
    const { simulation, program, key } = withOrbiterAtMars();
    const poor = { ...program, moneyMillions: 20 };
    expect(simulation.validatePlan(poor, skipTurn).problems).toEqual([
      "Upkeep of the Assets at Mars costs $30M, but the Program only has $20M. End some of their missions.",
    ]);
    expect(simulation.validatePlan(poor, ending(key)).problems).toEqual([]);
  });

  it("counts the upkeep before a Mission, so that a Mission can only spend what is left", () => {
    const { simulation, program } = withOrbiterAtMars();
    const tight = { ...program, moneyMillions: 520 };
    // The Test Orbiter costs 500 with its Launch Vehicle, which 520 covers until upkeep takes 30.
    expect(simulation.validatePlan(tight, sendOrbiter).problems).toEqual([
      "This Mission costs $500M, but the Program only has $490M after Upkeep of the Assets at Mars.",
    ]);
  });
});
