import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with the Test Habitat changed. */
function withHabitat(
  changes: Record<string, unknown>,
  files: CatalogueFiles = testCatalogueFiles(),
): unknown {
  return {
    ...files,
    assets: files.assets.map((asset) =>
      asset.id === "test-habitat" ? { ...asset, ...changes } : asset,
    ),
  };
}

describe("the habitat in the real data files", () => {
  const { assets, activities } = parseCatalogue(realCatalogueFiles());
  const habitats = assets.filter(({ habitat }) => habitat !== undefined);

  it("is one Asset that lands through entry/descent/landing, with Technology Readiness, Service Life and Upkeep", () => {
    expect(habitats.map(({ kind }) => kind)).toEqual(["habitat"]);
    const [habitat] = habitats;
    expect(habitat?.landsAtSite).toBe(true);
    expect(habitat?.missionEvents).toEqual(["entry-descent-landing"]);
    expect(habitat?.technologyReadiness).toBeDefined();
    expect(habitat?.serviceLifeOptions.length).toBeGreaterThan(0);
    expect(habitat?.upkeepMillionsPerTurn).toBeGreaterThan(0);
  });

  it("slows time at Mars by a share and holds Supplies, whatever its Activity, which earns nothing of its own", () => {
    const [habitat] = habitats;
    expect(habitat?.habitat?.timeAtMarsCutPercent).toBeGreaterThan(0);
    expect(habitat?.habitat?.timeAtMarsCutPercent).toBeLessThan(100);
    expect(habitat?.habitat?.suppliesKg).toBeGreaterThan(0);
    // Its Supplies are part of what it weighs.
    expect(habitat?.habitat?.suppliesKg ?? 0).toBeLessThan(
      (habitat?.massTonnes ?? 0) * 1000,
    );
    const own = activities.filter(({ id }) => habitat?.activities.includes(id));
    expect(own.map(({ effect }) => effect.kind)).toEqual(["nothing"]);
  });

  it("isn't the first Asset, which older saves and the first Missions use", () => {
    expect(assets[0]?.habitat).toBeUndefined();
  });
});

describe("invalid habitats", () => {
  it("accepts the Test Habitat", () => {
    const habitat = parseCatalogue(testCatalogueFiles()).assets.find(
      ({ id }) => id === "test-habitat",
    );
    expect(habitat?.habitat).toEqual({
      timeAtMarsCutPercent: 50,
      suppliesKg: 400,
    });
  });

  it.each([0, -5, 2.5, 101])(
    "rejects slowing time at Mars by %s percent",
    (timeAtMarsCutPercent) => {
      const message = errorFrom(
        withHabitat({ habitat: { timeAtMarsCutPercent, suppliesKg: 400 } }),
      );
      expect(message).toMatch(
        /assets\.json: \d+\.habitat\.timeAtMarsCutPercent:/,
      );
    },
  );

  it.each([0, -5, 2.5])("rejects holding %s kg of Supplies", (suppliesKg) => {
    const message = errorFrom(
      withHabitat({ habitat: { timeAtMarsCutPercent: 50, suppliesKg } }),
    );
    expect(message).toMatch(/assets\.json: \d+\.habitat\.suppliesKg:/);
  });

  it("rejects a habitat that slows something no rule knows", () => {
    const message = errorFrom(
      withHabitat({
        habitat: { timeAtMarsCutPercent: 50, suppliesKg: 400, radiation: 5 },
      }),
    );
    expect(message).toMatch(/assets\.json: \d+\.habitat:/);
  });

  it("rejects a habitat that doesn't land, as it houses Crew at a Landing Site", () => {
    const message = errorFrom(
      withHabitat({
        landsAtSite: false,
        missionEvents: ["test-arrival"],
      }),
    );
    expect(message).toContain(
      `assets.json: "test-habitat" is a habitat, which houses Crew at a Landing Site, so it must set landsAtSite`,
    );
  });
});
