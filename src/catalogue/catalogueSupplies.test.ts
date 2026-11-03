import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with these changes to its Crew's Supplies. */
function withSupplies(
  changes: Partial<CatalogueFiles["crew"]["supplies"]>,
): unknown {
  const files = testCatalogueFiles();
  return {
    ...files,
    crew: { ...files.crew, supplies: { ...files.crew.supplies, ...changes } },
  };
}

describe("Supplies in the real data files", () => {
  const { crew, trajectories, program, launchVehicles } =
    parseCatalogue(realCatalogueFiles());
  const { usePerMemberPerDayKg, options } = crew.supplies;
  /** How many days these Supplies last a Crew of this size. */
  const daysFor = (massTonnes: number, members: number) =>
    (massTonnes * 1000) / (members * usePerMemberPerDayKg);
  const least = Math.min(...options.map(({ massTonnes }) => massTonnes));
  const most = Math.max(...options.map(({ massTonnes }) => massTonnes));
  const sizes = crew.sizes.map((size) => size.crew);

  it("makes even the least Supplies last the largest Crew to Mars on the slowest Trajectory", () => {
    const slowest = Math.max(
      ...trajectories.map(({ transferDays }) => transferDays),
    );
    expect(daysFor(least, Math.max(...sizes))).toBeGreaterThan(slowest);
  });

  it("makes the most Supplies keep the smallest Crew through their flight and a whole Turn at Mars", () => {
    const slow = trajectories.find(({ id }) => id === "slow");
    expect(daysFor(most, Math.min(...sizes))).toBeGreaterThan(
      (slow?.transferDays ?? 0) + program.launchWindowIntervalDays,
    );
  });

  it("lets the smallest Crew carry the most Supplies on the Meridian Colossus", () => {
    const colossus = launchVehicles.find(
      ({ id }) => id === "meridian-colossus",
    );
    const smallest = crew.sizes[0]?.massTonnes ?? Infinity;
    expect(smallest + most).toBeLessThanOrEqual(colossus?.capacityTonnes ?? 0);
  });

  it("makes Crew with no Supplies lose Health much faster than at Mars with them", () => {
    const { radiationPerDay, timeAtMarsPerDay, noSuppliesPerDay } = crew.health;
    expect(noSuppliesPerDay).toBeGreaterThan(
      10 * (radiationPerDay.atMars + timeAtMarsPerDay),
    );
  });
});

describe("invalid Supplies", () => {
  it("accepts the Test Catalogue's Supplies", () => {
    expect(
      parseCatalogue(testCatalogueFiles()).crew.supplies.options,
    ).toHaveLength(2);
  });

  it("rejects Supplies out of order", () => {
    const { options } = testCatalogueFiles().crew.supplies;
    expect(
      errorFrom(withSupplies({ options: options.toReversed() })),
    ).toContain(
      `crew.json: the Supplies "test-supplies-short" weigh no more than "test-supplies-long" before them. Supplies go from least to most`,
    );
  });

  it("rejects the same Supplies listed twice", () => {
    const [short] = testCatalogueFiles().crew.supplies.options;
    if (!short) throw new Error("No Supplies");
    expect(
      errorFrom(
        withSupplies({ options: [short, { ...short, massTonnes: 3 }] }),
      ),
    ).toContain(
      `crew.json: the Supplies "test-supplies-short" are listed more than once`,
    );
  });

  it("rejects no Supplies on offer, and Supplies that weigh nothing", () => {
    expect(errorFrom(withSupplies({ options: [] }))).toContain(
      "crew.json: supplies.options:",
    );
    expect(
      errorFrom(
        withSupplies({
          options: [
            { id: "air", name: "Air", massTonnes: 0, costMillions: 100 },
          ],
        }),
      ),
    ).toContain("crew.json: supplies.options.0.massTonnes:");
  });

  it("rejects Crew who use no Supplies", () => {
    expect(errorFrom(withSupplies({ usePerMemberPerDayKg: 0 }))).toContain(
      "crew.json: supplies.usePerMemberPerDayKg:",
    );
  });

  it("rejects Health that rises with no Supplies", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        crew: {
          ...files.crew,
          health: { ...files.crew.health, noSuppliesPerDay: -1 },
        },
      }),
    ).toContain("crew.json: health.noSuppliesPerDay:");
  });
});
