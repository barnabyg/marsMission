import { describe, expect, it } from "vitest";
import type { Program, Simulation, TurnPlan } from "./simulation";
import type { PlannedMission } from "./types";
import { skipTurn, withFailures } from "./testHelpers";

/*
 * Sample caching: the Test Rover caches 20 samples over a whole 780-day Turn, a sample every 39 days, at its Landing
 * Site. Landing on day 205 of the first Turn, it caches for 575 days, which rounds up to 15 samples. Each sample that
 * reaches Earth earns 10 Science in the test catalogue.
 */

/** A rover landing at Alpha Plain on Sample caching, with whatever else the test sends beside it. */
function cachingRover(assetIds: string[] = []): PlannedMission {
  return {
    launchVehicleId: "test-heavy",
    assetIds: ["test-rover", ...assetIds],
    landingSiteId: "alpha-plain",
    assetChoices: { "test-rover": { activityId: "test-caching" } },
  };
}

/** A Program on its second Turn, after this Mission flew on the first. */
function after(mission: PlannedMission): {
  simulation: Simulation;
  program: Program;
} {
  const { simulation, program } = withFailures([], {
    startingMoneyMillions: 5000,
  });
  return {
    simulation,
    program: simulation.runTurn(program, { mission }).program,
  };
}

const samplesAt = (simulation: Simulation, program: Program) =>
  Object.fromEntries(
    simulation
      .readProgram(program)
      .landingSites.map(({ name, samples }) => [name, samples]),
  );

const sendHome: TurnPlan = { mission: null, bringHome: "samples:alpha-plain" };

describe("Sample caching", () => {
  it("offers Sample caching to a rover, saying what its samples would earn once home", () => {
    const { simulation, program } = withFailures([]);
    const [rover] = simulation.previewAssets(program, cachingRover());
    const caching = rover?.activities.find(({ id }) => id === "test-caching");
    expect(caching?.earnsPerTurn).toBeNull();
    expect(caching?.cachesPerTurn).toEqual({ samples: 20, science: 200 });
    expect(
      rover?.activities.find(({ id }) => id === "test-soil")?.cachesPerTurn,
    ).toBeNull();
  });

  it("caches samples at the rover's Landing Site over its days there, earning no Ongoing Research", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
    });
    const { program: next, summary } = simulation.runTurn(program, {
      mission: cachingRover(),
    });
    expect(summary.samplesCached).toEqual([
      {
        siteName: "Alpha Plain",
        cachedBy: ["Test Rover"],
        samples: 15,
        totalSamples: 15,
      },
    ]);
    expect(summary.ongoingResearch).toEqual([]);
    expect(samplesAt(simulation, next)).toEqual({
      "Alpha Plain": 15,
      "Beta Crater": 0,
    });
  });

  it("keeps the samples at the site from Turn to Turn, adding a whole Turn's worth", () => {
    const { simulation, program } = after(cachingRover());
    const { program: next, summary } = simulation.runTurn(program, skipTurn);
    expect(summary.samplesCached[0]?.samples).toBe(20);
    expect(samplesAt(simulation, next)["Alpha Plain"]).toBe(35);
  });

  it("keeps the samples once the rover stops caching", () => {
    const { simulation, program } = after(cachingRover());
    const [rover] = simulation.readProgram(program).operatingAssets;
    const { program: next, summary } = simulation.runTurn(program, {
      mission: null,
      operatingActivities: { [rover?.key ?? ""]: "test-traverse" },
    });
    expect(summary.samplesCached).toEqual([]);
    expect(samplesAt(simulation, next)["Alpha Plain"]).toBe(15);
  });

  it("survives saving and loading", () => {
    const { simulation, program } = after(cachingRover());
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(program))),
    );
    expect(restored).toEqual(program);
    expect(samplesAt(simulation, restored)["Alpha Plain"]).toBe(15);
  });
});

describe("offering to send samples home", () => {
  it("offers a site's samples when an ascent vehicle is there and an Earth return orbiter is in Mars orbit", () => {
    const { simulation, program } = after(
      cachingRover(["test-ascent-vehicle", "test-return-orbiter"]),
    );
    expect(simulation.readProgram(program).sampleReturns).toEqual([
      {
        key: "samples:alpha-plain",
        siteName: "Alpha Plain",
        samples: 15,
        science: 150,
        ascentVehicle: "Test Lifter",
        orbiter: "Test Return Orbiter",
        leavesMarsOn: "2031-04-30",
        homeOn: "2031-11-16",
        reason: null,
      },
    ]);
    expect(simulation.validatePlan(program, sendHome).problems).toEqual([]);
  });

  it("says why it can't send them home with no ascent vehicle at the site", () => {
    const { simulation, program } = after(
      cachingRover(["test-return-orbiter"]),
    );
    const reason =
      "Samples at Alpha Plain need an ascent vehicle there to lift them into Mars orbit.";
    const [offer] = simulation.readProgram(program).sampleReturns;
    expect(offer).toMatchObject({ ascentVehicle: null, reason });
    expect(simulation.validatePlan(program, sendHome).problems).toEqual([
      reason,
    ]);
  });

  it("says why it can't send them home with no Earth return orbiter in Mars orbit", () => {
    const { simulation, program } = after(
      cachingRover(["test-ascent-vehicle"]),
    );
    const [offer] = simulation.readProgram(program).sampleReturns;
    expect(offer).toMatchObject({
      orbiter: null,
      reason:
        "Samples at Alpha Plain need an Earth return orbiter waiting in Mars orbit to fly them home.",
    });
  });

  it("refuses a plan that ends the mission of the ascent vehicle it would fly", () => {
    const { simulation, program } = after(
      cachingRover(["test-ascent-vehicle", "test-return-orbiter"]),
    );
    const lifter = simulation
      .readProgram(program)
      .operatingAssets.find(({ kind }) => kind === "ascent-vehicle");
    expect(
      simulation.validatePlan(program, {
        ...sendHome,
        endedAssetKeys: [lifter?.key ?? ""],
      }).problems,
    ).toEqual([
      "Samples at Alpha Plain need an ascent vehicle there to lift them into Mars orbit.",
    ]);
  });

  it("offers nothing for a site with no samples, and refuses a plan that names one", () => {
    const { simulation, program } = after({
      launchVehicleId: "test-heavy",
      assetIds: ["test-ascent-vehicle", "test-return-orbiter"],
      landingSiteId: "alpha-plain",
    });
    expect(simulation.readProgram(program).sampleReturns).toEqual([]);
    expect(simulation.validatePlan(program, sendHome).problems).toEqual([
      "There are no samples at Alpha Plain to send home.",
    ]);
    // A plan names the site by its key, which the player is never shown.
    expect(
      simulation.validatePlan(program, {
        ...sendHome,
        bringHome: "samples:nowhere",
      }).problems,
    ).toEqual(["There are no samples at that Landing Site to send home."]);
  });
});

describe("saves from before samples", () => {
  it("upgrades a save from before samples with none at any Landing Site", () => {
    const { simulation } = withFailures([]);
    // A literal copy of what format 11 looks like. Don't change this: it's a compatibility contract.
    const formatEleven = {
      formatVersion: 11,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [
          {
            assetId: "test-rover",
            name: "Test Rover",
            kind: "rover",
            arrivedOn: "2029-06-24",
            landingSiteId: "alpha-plain",
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-soil",
            flewUnproven: false,
          },
        ],
        crew: [],
        crewActivities: {},
        crewSupplies: {},
        earthReturnStages: [],
        ascentPropellantKg: {},
        habitatSuppliesKg: {},
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatEleven);
    expect(samplesAt(simulation, restored)).toEqual({
      "Alpha Plain": 0,
      "Beta Crater": 0,
    });
    expect(simulation.readProgram(restored).sampleReturns).toEqual([]);
    const [rover] = simulation.readProgram(restored).operatingAssets;
    const next = simulation.runTurn(restored, {
      mission: null,
      operatingActivities: { [rover?.key ?? ""]: "test-caching" },
    }).program;
    expect(samplesAt(simulation, next)["Alpha Plain"]).toBe(20);
  });
});
