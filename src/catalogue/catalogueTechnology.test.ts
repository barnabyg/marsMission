import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

describe("Technology Readiness in the real data files", () => {
  it("starts every Asset and Launch Vehicle from earlier phases Flight-proven", () => {
    const { assets, launchVehicles } = parseCatalogue(realCatalogueFiles());
    const earlier = [
      "pathfinder-orbiter",
      "prospector-lander",
      "trailblazer-rover",
      "meridian-medium",
      "meridian-heavy",
    ];
    const readiness = [...assets, ...launchVehicles]
      .filter(({ id }) => earlier.includes(id))
      .map(({ technologyReadiness }) => technologyReadiness);
    expect(readiness).toEqual(earlier.map(() => "flight-proven"));
  });

  it("has a lander that is built but not yet flown, which lands more safely once Flight-proven", () => {
    const { assets } = parseCatalogue(realCatalogueFiles());
    const unproven = assets.filter(
      ({ technologyReadiness }) => technologyReadiness === "built",
    );
    // The fuel plant, the habitat and the Mars lab, new in Phase 8, start built but unproven too.
    expect(unproven.map(({ kind }) => kind)).toEqual([
      "lander",
      "fuel-plant",
      "habitat",
      "lab",
    ]);
    expect(unproven[0]?.landingRiskMultiplier).toBeLessThan(1);
  });

  it("has a technology that needs Development, with its cost and Turns", () => {
    const { assets, launchVehicles } = parseCatalogue(realCatalogueFiles());
    const needingDevelopment = [...assets, ...launchVehicles].filter(
      ({ technologyReadiness }) => technologyReadiness === "not-built",
    );
    expect(needingDevelopment.length).toBeGreaterThan(0);
    for (const { development } of needingDevelopment) {
      expect(development?.costMillions).toBeGreaterThan(0);
      expect(development?.turns).toBeGreaterThan(0);
    }
  });
});

describe("invalid Development", () => {
  it("rejects a technology that isn't built with no Development", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) => ({
        ...vehicle,
        technologyReadiness: "not-built",
        unproven: { costMillions: 500, failureMultiplier: 2 },
        development: undefined,
      })),
    });
    expect(message).toContain(
      `launch-vehicles.json: "test-vehicle" isn't built yet, so it must have "development"`,
    );
  });

  it.each(["flight-proven", "built"] as const)(
    "rejects Development for a technology that starts %s",
    (technologyReadiness) => {
      const files = testCatalogueFiles();
      const message = errorFrom({
        ...files,
        assets: files.assets.map((asset) => ({
          ...asset,
          technologyReadiness,
          unproven:
            technologyReadiness === "built"
              ? { costMillions: 5000, failureMultiplier: 2 }
              : undefined,
          development: { costMillions: 500, turns: 2 },
        })),
      });
      expect(message).toContain(
        `assets.json: "test-orbiter" is already built, so it can't have "development"`,
      );
    },
  );

  it("rejects a technology that isn't built with no unproven cost and failure multiplier, for after its Development", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: "not-built",
        unproven: undefined,
        development: { costMillions: 500, turns: 2 },
      })),
    });
    expect(message).toContain(`"test-orbiter" isn't Flight-proven`);
  });

  it.each([
    ["no Turns", 0],
    ["part of a Turn", 1.5],
  ])("rejects Development that takes %s", (_, turns) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: "not-built",
        unproven: { costMillions: 5000, failureMultiplier: 2 },
        development: { costMillions: 500, turns },
      })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("turns");
  });
});

describe("invalid Technology Readiness", () => {
  it("rejects an Asset with no Technology Readiness", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: undefined,
      })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("technologyReadiness");
  });

  it("rejects a technology that isn't Flight-proven with no unproven cost and reliability", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) => ({
        ...vehicle,
        technologyReadiness: "built",
        unproven: undefined,
      })),
    });
    expect(message).toContain("launch-vehicles.json");
    expect(message).toContain('"test-vehicle" isn\'t Flight-proven');
  });

  it("rejects an unproven cost and reliability for a technology that starts Flight-proven", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: "flight-proven",
        unproven: { costMillions: 900, failureMultiplier: 2 },
      })),
    });
    expect(message).toContain(
      'assets.json: "test-orbiter" starts Flight-proven',
    );
  });

  it("rejects an unproven technology that costs less than it will once Flight-proven", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: "built",
        unproven: { costMillions: 1, failureMultiplier: 2 },
      })),
    });
    expect(message).toContain(
      'assets.json: "test-orbiter" costs less unproven than Flight-proven',
    );
  });

  it("rejects an unproven technology that fails less often than once Flight-proven", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        technologyReadiness: "built",
        unproven: { costMillions: 5000, failureMultiplier: 0.5 },
      })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("failureMultiplier");
  });

  it("rejects an Asset and a Launch Vehicle with the same id, because Flight-proven status is saved by id", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) => ({
        ...vehicle,
        id: vehicle.id === "test-vehicle" ? "test-orbiter" : vehicle.id,
      })),
    });
    expect(message).toContain(
      'the id "test-orbiter" is used by both an Asset and a Launch Vehicle',
    );
  });

  it("rejects a landing risk multiplier on an Asset that doesn't land", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        landingRiskMultiplier: 0.5,
      })),
    });
    expect(message).toContain(
      'assets.json: "test-orbiter" has a landingRiskMultiplier, but doesn\'t land',
    );
  });
});
