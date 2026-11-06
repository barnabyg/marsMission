import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with the Test Relay's Benefit replaced. */
function withRelayBenefit(
  benefit: unknown,
  files: CatalogueFiles = testCatalogueFiles(),
): unknown {
  return {
    ...files,
    assets: files.assets.map((asset) =>
      asset.id === "test-relay" ? { ...asset, benefit } : asset,
    ),
  };
}

describe("Benefits in the real data files", () => {
  it("has a relay orbiter that raises surface research, with a Technology Readiness like every Asset", () => {
    const { assets } = parseCatalogue(realCatalogueFiles());
    const giving = assets.filter(
      ({ benefit }) => benefit?.raises === "surfaceResearch",
    );
    expect(giving.map(({ kind }) => kind)).toEqual(["orbiter"]);
    const [relay] = giving;
    expect(relay?.benefit?.raises).toBe("surfaceResearch");
    expect(relay?.benefit?.percent).toBeGreaterThan(0);
    expect(relay?.technologyReadiness).toBeDefined();
  });
});

describe("invalid Benefits", () => {
  it("accepts the Test Relay's Benefit", () => {
    const relay = parseCatalogue(testCatalogueFiles()).assets.find(
      ({ id }) => id === "test-relay",
    );
    expect(relay?.benefit).toEqual({ raises: "surfaceResearch", percent: 50 });
  });

  it("rejects a Benefit that raises something no rule knows", () => {
    const message = errorFrom(
      withRelayBenefit({ raises: "everything", percent: 50 }),
    );
    expect(message).toContain("assets.json: 2.benefit.raises:");
  });

  it.each([0, -10, 12.5])("rejects a Benefit of %s percent", (percent) => {
    const message = errorFrom(
      withRelayBenefit({ raises: "surfaceResearch", percent }),
    );
    expect(message).toContain("assets.json: 2.benefit.percent:");
  });

  it("rejects a Benefit to surface research when nothing on the surface does research", () => {
    const files = testCatalogueFiles();
    const message = errorFrom(
      withRelayBenefit(
        { raises: "surfaceResearch", percent: 50 },
        {
          ...files,
          assets: files.assets.map((asset) =>
            asset.landsAtSite === true
              ? { ...asset, activities: ["test-nothing"] }
              : asset,
          ),
        },
      ),
    );
    expect(message).toContain(
      `assets.json: "test-relay" raises surface research, which no Asset that lands has an Activity to earn`,
    );
  });
});
