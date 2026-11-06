import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with one Asset changed. */
function withAsset(
  assetId: string,
  changes: Record<string, unknown>,
  files: CatalogueFiles = testCatalogueFiles(),
): CatalogueFiles {
  return {
    ...files,
    assets: files.assets.map((asset) =>
      asset.id === assetId ? { ...asset, ...changes } : asset,
    ),
  };
}

describe("sample return in the real data files", () => {
  const { assets, activities, milestones, program, crew } =
    parseCatalogue(realCatalogueFiles());
  const caching = activities.filter(
    ({ effect }) => effect.kind === "sampleCaching",
  );

  it("has Sample caching, which rovers can do and which earns no Ongoing Research", () => {
    expect(caching.map(({ name }) => name)).toEqual(["Sample caching"]);
    const [activity] = caching;
    const rovers = assets.filter(({ kind }) => kind === "rover");
    expect(rovers.length).toBeGreaterThan(0);
    for (const rover of rovers) {
      expect(rover.activities).toContain(activity?.id);
      // A rover starts on research unless the player chooses otherwise.
      expect(rover.activities[0]).not.toBe(activity?.id);
    }
  });

  it("has an ascent vehicle that lands and an Earth return orbiter that waits in Mars orbit, each built but unproven, with Service Life and Upkeep", () => {
    const ascent = assets.filter(
      ({ sampleReturn }) => sampleReturn === "ascent",
    );
    const orbiters = assets.filter(
      ({ sampleReturn }) => sampleReturn === "earthReturn",
    );
    expect(ascent.map(({ kind }) => kind)).toEqual(["ascent-vehicle"]);
    expect(orbiters.map(({ kind }) => kind)).toEqual(["return-orbiter"]);
    expect(ascent[0]?.landsAtSite).toBe(true);
    expect(ascent[0]?.missionEvents).toEqual(["entry-descent-landing"]);
    expect(orbiters[0]?.landsAtSite).toBeUndefined();
    expect(orbiters[0]?.missionEvents).toEqual(["mars-orbit-insertion"]);
    for (const asset of [...ascent, ...orbiters]) {
      expect(asset.technologyReadiness).toBe("built");
      expect(asset.upkeepMillionsPerTurn).toBeGreaterThan(0);
      expect(asset.serviceLifeOptions.length).toBeGreaterThan(0);
    }
  });

  it("puts them last, so that adding them changes no seed's rolls for the Assets before them", () => {
    expect(assets.slice(-2).map(({ kind }) => kind)).toEqual([
      "ascent-vehicle",
      "return-orbiter",
    ]);
  });

  it("rewards returned samples with Science, samples of the Crew's own and a Milestone for the first", () => {
    expect(program.sciencePerSampleHome).toBeGreaterThan(0);
    expect(crew.roundTrip.ascent.samplesPerMember).toBeGreaterThan(0);
    expect(
      milestones
        .filter(({ trigger }) => "samplesComeHome" in trigger)
        .map(({ name }) => name),
    ).toEqual(["First samples returned"]);
  });
});

describe("invalid sample return", () => {
  it("accepts the Test Catalogue's ascent vehicle, Earth return orbiter and Sample caching", () => {
    const { assets } = parseCatalogue(testCatalogueFiles());
    expect(assets.flatMap(({ sampleReturn }) => sampleReturn ?? [])).toEqual([
      "ascent",
      "earthReturn",
    ]);
  });

  it("rejects an Asset that caches samples without landing", () => {
    expect(
      errorFrom(
        withAsset("test-orbiter", {
          activities: ["test-survey", "test-caching"],
        }),
      ),
    ).toContain(
      `assets.json: "test-orbiter" can do the Activity "test-caching", which caches samples at a Landing Site, so it must set landsAtSite`,
    );
  });

  it("rejects an ascent vehicle that doesn't land", () => {
    expect(
      errorFrom(
        withAsset("test-ascent-vehicle", {
          landsAtSite: false,
          missionEvents: ["test-arrival"],
        }),
      ),
    ).toContain(
      `assets.json: "test-ascent-vehicle" is an ascent vehicle, which lifts samples off a Landing Site, so it must set landsAtSite`,
    );
  });

  it("rejects an Earth return orbiter that lands", () => {
    expect(
      errorFrom(
        withAsset("test-return-orbiter", {
          landsAtSite: true,
          missionEvents: ["test-landing"],
        }),
      ),
    ).toContain(
      `assets.json: "test-return-orbiter" is an Earth return orbiter, which waits in Mars orbit, so it can't set landsAtSite`,
    );
  });

  it("rejects an ascent vehicle with no Earth return orbiter to meet", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        assets: files.assets.filter(({ id }) => id !== "test-return-orbiter"),
      }),
    ).toContain(
      `assets.json: an ascent vehicle needs an Earth return orbiter to meet in Mars orbit`,
    );
  });

  it("rejects an unknown part in sample return", () => {
    expect(
      errorFrom(withAsset("test-ascent-vehicle", { sampleReturn: "relay" })),
    ).toMatch(/assets\.json: \d+\.sampleReturn:/);
  });

  it("rejects caching no samples", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        activities: files.activities.map((activity) =>
          activity.id === "test-caching"
            ? {
                ...activity,
                effect: { ...activity.effect, samplesPerTurn: 0 },
              }
            : activity,
        ),
      }),
    ).toMatch(/activities\.json: \d+\.effect\.samplesPerTurn:/);
  });

  it("rejects a First samples returned Milestone that nothing could earn", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        crew: {
          ...files.crew,
          roundTrip: {
            ...files.crew.roundTrip,
            ascent: { ...files.crew.roundTrip.ascent, samplesPerMember: 0 },
          },
        },
        assets: files.assets.filter(
          ({ sampleReturn }) => sampleReturn === undefined,
        ),
      }),
    ).toContain(
      `milestones.json: "first-samples-home" needs samples to come home, but Crew bring none of their own and no Asset caches samples for an ascent vehicle and an Earth return orbiter to bring`,
    );
  });

  it("rejects negative Science for a returned sample", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        program: { ...files.program, sciencePerSampleHome: -1 },
      }),
    ).toMatch(/program\.json: sciencePerSampleHome:/);
  });
});
