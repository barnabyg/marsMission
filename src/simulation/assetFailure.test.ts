import { describe, expect, it } from "vitest";
import { CatalogueError, parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Simulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { skipTurn } from "./testHelpers";

/** The Test Catalogue where orbiters have this chance of failing in service, and a Service Life of `days`. */
function withChance(chance: number, days = 50_000) {
  const files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        failureChancePerTurn: chance,
        serviceLifeOptions: [{ days, costMillions: 0 }],
      })),
    }),
  );
}

const orbiterWith = (reliabilityLevelId?: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    ...(reliabilityLevelId && {
      assetChoices: { "test-orbiter": { reliabilityLevelId } },
    }),
  },
});

/** The Turn after the one a new orbiter arrives in. */
function turnInService(
  simulation: Simulation,
  seed: number,
  level?: string,
  plan: TurnPlan = skipTurn,
) {
  const { program } = simulation.runTurn(
    simulation.startProgram(seed),
    orbiterWith(level),
  );
  return simulation.runTurn(program, plan);
}

describe("buying Reliability for an Asset", () => {
  it("shows the chance per Turn as a Risk Band, for each level, and adds its cost", () => {
    const simulation = withChance(0.08);
    const program = simulation.startProgram(1);
    const mission = orbiterWith("tested").mission;
    if (!mission) throw new Error("Expected a Mission");
    const [asset] = simulation.previewAssets(mission);
    expect(asset?.riskBand).toBe("~5%");
    expect(asset?.reliabilityLevelId).toBe("tested");
    expect(asset?.reliabilityLevels.map(({ riskBand }) => riskBand)).toEqual([
      "~10%",
      "~5%",
      "~1%",
    ]);
    expect(simulation.validatePlan(program, orbiterWith()).costMillions).toBe(
      500,
    );
    expect(
      simulation.validatePlan(program, orbiterWith("tested")).costMillions,
    ).toBe(550);
  });

  it("refuses a level that doesn't exist", () => {
    const simulation = withChance(0);
    const { problems } = simulation.validatePlan(
      simulation.startProgram(1),
      orbiterWith("gold-plated"),
    );
    expect(problems.join(" ")).toContain("gold-plated");
  });
});

describe("an Asset failing in service", () => {
  it("stops it on a date within the Turn, in the events column and the Turn summary", () => {
    const simulation = withChance(1);
    const { timeline, summary, program } = turnInService(simulation, 7);
    const [entry] = timeline.entries.filter(
      ({ kind }) => kind === "assetFailed",
    );
    expect(entry?.title).toBe("Test Orbiter failed");
    expect(entry?.day).toBeGreaterThan(0);
    expect(entry?.day).toBeLessThan(780);
    expect(timeline.assetsAtMars[0]?.untilDay).toBe(entry?.day);
    expect(summary.assetsFailed).toEqual(["Test Orbiter"]);
    expect(summary.assetsEnded).toEqual([]);
    expect(simulation.readProgram(program).operatingAssets).toEqual([]);
  });

  it("costs no Public Support beyond the usual fade", () => {
    const simulation = withChance(1);
    const first = simulation.runTurn(simulation.startProgram(7), orbiterWith());
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.publicSupportEnd).toBe(
      Math.floor(first.program.publicSupport * 0.85),
    );
  });

  it("can't happen in the Turn it arrives", () => {
    const simulation = withChance(1);
    for (let seed = 1; seed <= 50; seed++) {
      const { summary, program } = simulation.runTurn(
        simulation.startProgram(seed),
        orbiterWith(),
      );
      expect(summary.assetsFailed).toEqual([]);
      expect(simulation.readProgram(program).operatingAssets).toHaveLength(1);
    }
  });

  it("always comes before the Service Life ends, and not at all once it has", () => {
    // Arrives on day 200 and ends after 1000 days, which is day 420 of the next Turn.
    const simulation = withChance(1, 1000);
    for (let seed = 1; seed <= 200; seed++) {
      const { timeline, summary } = turnInService(simulation, seed);
      expect(summary.assetsFailed).toEqual(["Test Orbiter"]);
      expect(summary.assetsEnded).toEqual([]);
      const day = timeline.assetsAtMars[0]?.untilDay ?? Infinity;
      expect(day).toBeGreaterThan(0);
      expect(day).toBeLessThan(420);
    }
  });

  it("doesn't happen to an Asset whose Service Life has already passed", () => {
    // Ends exactly at the next Launch Window, so it has no time left in that Turn.
    const simulation = withChance(1, 580);
    const { summary } = turnInService(simulation, 7);
    expect(summary.assetsFailed).toEqual([]);
    expect(summary.assetsEnded).toEqual(["Test Orbiter"]);
  });

  it("still counts for that Turn's Survey, and for no later ones", () => {
    const simulation = withChance(1);
    const { summary, program } = turnInService(simulation, 7);
    expect(summary.survey?.siteNameRevealed).toBe("Delta Rift");
    const later = simulation.runTurn(program, skipTurn);
    expect(later.summary.survey).toBeNull();
  });
});

describe("the roll for an Asset in service", () => {
  it("never makes an Asset more likely to fail with more Reliability, and lowers the rate", () => {
    const simulation = withChance(0.4);
    const rate = (level?: string) => {
      let failures = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const plain = turnInService(simulation, seed).summary.assetsFailed;
        const bought = turnInService(simulation, seed, level).summary
          .assetsFailed;
        if (bought.length > 0) {
          failures++;
          expect(plain).toEqual(["Test Orbiter"]);
        }
      }
      return failures;
    };
    const none = rate("none");
    const tested = rate("tested");
    const redundant = rate("redundant");
    expect(none).toBeGreaterThan(330);
    expect(none).toBeLessThan(470);
    expect(tested).toBeLessThan(none);
    expect(redundant).toBeLessThan(tested);
  });

  it("gives the same failures for the same seed and plans", () => {
    const simulation = withChance(0.5);
    for (let seed = 1; seed <= 50; seed++) {
      expect(turnInService(simulation, seed)).toEqual(
        turnInService(simulation, seed),
      );
    }
  });

  it("isn't re-rolled by changing another Asset or a Mission Event's Reliability", () => {
    const simulation = withChance(0.5);
    for (let seed = 1; seed <= 100; seed++) {
      const without = turnInService(simulation, seed);
      const withMission = turnInService(simulation, seed, undefined, {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-relay"],
          reliability: { "test-launch": "redundant" },
          assetChoices: { "test-relay": { reliabilityLevelId: "redundant" } },
        },
      });
      expect(withMission.summary.assetsFailed).toEqual(
        without.summary.assetsFailed,
      );
      expect(
        withMission.timeline.entries.find(({ kind }) => kind === "assetFailed")
          ?.day,
      ).toBe(
        without.timeline.entries.find(({ kind }) => kind === "assetFailed")
          ?.day,
      );
    }
  });
});

describe("Reliability for an Asset in saves", () => {
  it("gives the same outcome after reloading a save", () => {
    const simulation = withChance(0.5);
    for (let seed = 1; seed <= 30; seed++) {
      const { program } = simulation.runTurn(
        simulation.startProgram(seed),
        orbiterWith("tested"),
      );
      const restored = simulation.restoreProgram(
        JSON.parse(JSON.stringify(simulation.saveProgram(program))),
      );
      expect(simulation.runTurn(restored, skipTurn)).toEqual(
        simulation.runTurn(program, skipTurn),
      );
    }
  });

  it("keeps each Asset's level", () => {
    const simulation = withChance(0);
    const { program } = simulation.runTurn(
      simulation.startProgram(1),
      orbiterWith("redundant"),
    );
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(program))),
    );
    expect(
      simulation.readProgram(restored).operatingAssets[0]?.reliabilityLevelId,
    ).toBe("redundant");
  });

  it("gives an older save's Assets the cheapest level", () => {
    const simulation = withChance(0);
    const restored = simulation.restoreProgram({
      formatVersion: 4,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-19",
        moneyMillions: 2000,
        publicSupport: 200,
        science: 100,
        milestoneIds: [],
        landedSiteIds: [],
        knownLandingSiteIds: ["alpha-plain"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [
          {
            assetId: "test-orbiter",
            name: "Test Orbiter",
            kind: "orbiter",
            arrivedOn: "2029-06-19",
            landingSiteId: null,
            serviceLifeDays: 1000,
          },
        ],
        status: { kind: "active" },
      },
    });
    expect(
      simulation.readProgram(restored).operatingAssets[0]?.reliabilityLevelId,
    ).toBe("none");
  });
});

describe("the in-service failure chance in the data files", () => {
  it("is rejected if it's not a probability", () => {
    const files = testCatalogueFiles();
    const reject = () =>
      parseCatalogue({
        ...files,
        assets: files.assets.map((asset) => ({
          ...asset,
          failureChancePerTurn: 1.5,
        })),
      });
    expect(reject).toThrow(CatalogueError);
    expect(reject).toThrow(/assets\.json.*failureChancePerTurn/);
  });
});
