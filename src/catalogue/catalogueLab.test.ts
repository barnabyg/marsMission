import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

const labBenefit = {
  raises: "siteResearchGrants",
  percent: 100,
  assetKinds: ["rover"],
  crew: true,
};

/** The Test Catalogue with the Test Lab changed. */
function withLab(
  changes: Record<string, unknown>,
  files: CatalogueFiles = testCatalogueFiles(),
): unknown {
  return {
    ...files,
    assets: files.assets.map((asset) =>
      asset.id === "test-lab" ? { ...asset, ...changes } : asset,
    ),
  };
}

describe("the Mars lab in the real data files", () => {
  const { assets, activities, researchKinds, crew } =
    parseCatalogue(realCatalogueFiles());
  const labs = assets.filter(
    ({ benefit }) => benefit?.raises === "siteResearchGrants",
  );

  it("is one Asset that lands through entry/descent/landing, with Technology Readiness, Service Life and Upkeep", () => {
    expect(labs.map(({ kind }) => kind)).toEqual(["lab"]);
    const [lab] = labs;
    expect(lab?.landsAtSite).toBe(true);
    expect(lab?.missionEvents).toEqual(["entry-descent-landing"]);
    expect(lab?.technologyReadiness).toBe("built");
    expect(lab?.serviceLifeOptions.length).toBeGreaterThan(0);
    expect(lab?.upkeepMillionsPerTurn).toBeGreaterThan(0);
  });

  it("raises the Research Grants of rovers and Crew at its Landing Site, whatever its Activity, which earns nothing of its own", () => {
    const [lab] = labs;
    expect(lab?.benefit).toEqual({
      raises: "siteResearchGrants",
      percent: expect.any(Number) as number,
      assetKinds: ["rover"],
      crew: true,
    });
    const own = activities.filter(({ id }) => lab?.activities.includes(id));
    expect(own.map(({ effect }) => effect.kind)).toEqual(["nothing"]);
    // Something it raises pays a Research Grant, for rovers and for Crew on the surface.
    const pays = (activityId: string) => {
      const effect = activities.find(({ id }) => id === activityId)?.effect;
      const kind =
        effect?.kind === "research"
          ? researchKinds.find(({ id }) => id === effect.researchKind)
          : undefined;
      return (kind?.grantMillionsPerScience ?? 0) > 0;
    };
    const rovers = assets.filter(({ kind }) => kind === "rover");
    expect(rovers.some((rover) => rover.activities.some(pays))).toBe(true);
    expect(crew.surfaceActivities.some(pays)).toBe(true);
  });

  it("comes after every earlier Asset, so that adding it changes no seed's rolls for them", () => {
    expect(assets.findIndex(({ kind }) => kind === "lab")).toBe(
      assets.findIndex(({ kind }) => kind === "habitat") + 1,
    );
  });
});

describe("invalid Mars labs", () => {
  it("accepts the Test Lab", () => {
    const lab = parseCatalogue(testCatalogueFiles()).assets.find(
      ({ id }) => id === "test-lab",
    );
    expect(lab?.benefit).toEqual(labBenefit);
  });

  it.each([0, -10, 12.5])("rejects raising grants by %s percent", (percent) => {
    const message = errorFrom(withLab({ benefit: { ...labBenefit, percent } }));
    expect(message).toMatch(/assets\.json: \d+\.benefit\.percent:/);
  });

  it("rejects a lab that leaves out whom it raises", () => {
    const message = errorFrom(
      withLab({ benefit: { raises: "siteResearchGrants", percent: 100 } }),
    );
    expect(message).toMatch(/assets\.json: \d+\.benefit\.assetKinds:/);
  });

  it("rejects a lab that doesn't land, as it raises grants at its Landing Site", () => {
    const message = errorFrom(
      withLab({ landsAtSite: false, missionEvents: ["test-arrival"] }),
    );
    expect(message).toContain(
      `assets.json: "test-lab" raises Research Grants at its Landing Site, so it must set landsAtSite`,
    );
  });

  it("rejects raising a kind of Asset that never lands", () => {
    const message = errorFrom(
      withLab({ benefit: { ...labBenefit, assetKinds: ["rover", "orbiter"] } }),
    );
    expect(message).toContain(
      `assets.json: "test-lab" raises the Research Grants of "orbiter" Assets at its Landing Site, but no Asset of that kind lands`,
    );
  });

  it("rejects raising nothing that pays a Research Grant", () => {
    const message = errorFrom(
      withLab({ benefit: { ...labBenefit, assetKinds: [], crew: false } }),
    );
    expect(message).toContain(
      `assets.json: "test-lab" raises Research Grants at its Landing Site, but nothing it raises has an Activity that pays one`,
    );
  });
});
