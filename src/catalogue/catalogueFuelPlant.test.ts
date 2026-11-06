import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with the Test Fuel Plant changed. */
function withFuelPlant(
  changes: Record<string, unknown>,
  files: CatalogueFiles = testCatalogueFiles(),
): unknown {
  return {
    ...files,
    assets: files.assets.map((asset) =>
      asset.id === "test-fuel-plant" ? { ...asset, ...changes } : asset,
    ),
  };
}

describe("the fuel plant in the real data files", () => {
  const { assets, activities } = parseCatalogue(realCatalogueFiles());
  const making = assets.filter(({ makes }) => makes !== undefined);

  it("is one Asset that lands through entry/descent/landing, with Technology Readiness, Service Life and Upkeep", () => {
    expect(making.map(({ kind }) => kind)).toEqual(["fuel-plant"]);
    const [plant] = making;
    expect(plant?.landsAtSite).toBe(true);
    expect(plant?.missionEvents).toEqual(["entry-descent-landing"]);
    expect(plant?.technologyReadiness).toBeDefined();
    expect(plant?.serviceLifeOptions.length).toBeGreaterThan(0);
    expect(plant?.upkeepMillionsPerTurn).toBeGreaterThan(0);
  });

  it("makes ascent propellant at a steady rate, whatever its Activity, which earns nothing of its own", () => {
    const [plant] = making;
    expect(plant?.makes?.ascentPropellantKgPerDay).toBeGreaterThan(0);
    const own = activities.filter(({ id }) => plant?.activities.includes(id));
    expect(own.map(({ effect }) => effect.kind)).toEqual(["nothing"]);
  });

  it("isn't the first Asset or the first Activity of doing nothing, which older saves and the first Missions use", () => {
    expect(assets[0]?.makes).toBeUndefined();
    expect(activities.find(({ effect }) => effect.kind === "nothing")?.id).toBe(
      "nothing",
    );
  });
});

describe("invalid fuel plants", () => {
  it("accepts the Test Fuel Plant", () => {
    const plant = parseCatalogue(testCatalogueFiles()).assets.find(
      ({ id }) => id === "test-fuel-plant",
    );
    expect(plant?.makes).toEqual({ ascentPropellantKgPerDay: 10 });
  });

  it.each([0, -5, 2.5])(
    "rejects making %s kg of ascent propellant a day",
    (ascentPropellantKgPerDay) => {
      const message = errorFrom(
        withFuelPlant({ makes: { ascentPropellantKgPerDay } }),
      );
      expect(message).toMatch(
        /assets\.json: \d+\.makes\.ascentPropellantKgPerDay:/,
      );
    },
  );

  it("rejects making something no rule knows", () => {
    const message = errorFrom(withFuelPlant({ makes: { water: 10 } }));
    expect(message).toMatch(/assets\.json: \d+\.makes:/);
  });

  it("rejects a fuel plant that doesn't land, as ascent propellant is made at a Landing Site", () => {
    const message = errorFrom(
      withFuelPlant({
        landsAtSite: false,
        missionEvents: ["test-arrival"],
      }),
    );
    expect(message).toContain(
      `assets.json: "test-fuel-plant" makes ascent propellant, which is made at a Landing Site, so it must set landsAtSite`,
    );
  });
});
