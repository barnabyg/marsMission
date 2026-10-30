import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogue, testCatalogueFiles } from "./testCatalogue";

const sendOrbiter: TurnPlan = {
  mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
};

function setup() {
  const simulation = createSimulation(testCatalogue());
  return { simulation, program: simulation.startProgram(42) };
}

describe("starting a Program", () => {
  it("begins at the first Launch Window with the catalogue's money and Public Support", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.turnNumber).toBe(1);
    expect(view.date).toBe("2028-12-01");
    expect(view.moneyMillions).toBe(2000);
    expect(view.publicSupport).toBe(100);
    expect(view.operatingAssets).toEqual([]);
  });

  it("offers the catalogue's Launch Vehicles and Assets", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.launchVehicles.map((vehicle) => vehicle.id)).toEqual([
      "test-vehicle",
    ]);
    expect(view.assets.map((asset) => asset.id)).toEqual([
      "test-orbiter",
      "gold-orbiter",
      "test-relay",
    ]);
  });
});

describe("validating a plan", () => {
  it("reports the Mission's total cost", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendOrbiter)).toEqual({
      costMillions: 500,
      problems: [],
    });
  });

  it("rejects a plan the player can't afford, with a clear reason", () => {
    const { simulation, program } = setup();
    const plan = {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["gold-orbiter"] },
    };
    const { costMillions, problems } = simulation.validatePlan(program, plan);
    expect(costMillions).toBe(5100);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/\$5\.1B.*\$2B/);
    expect(() => simulation.runTurn(program, plan)).toThrow(/\$5\.1B/);
  });

  it("rejects ids that aren't in the catalogue", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "nope", assetIds: ["also-nope"] },
    });
    expect(problems.join(" ")).toContain("nope");
    expect(problems.join(" ")).toContain("also-nope");
  });

  it("rejects a Mission that carries nothing", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: [] },
    });
    expect(problems).toHaveLength(1);
  });
});

describe("running a Turn with a Mission", () => {
  it("deducts the Mission's cost", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
    });
    expect(simulation.readProgram(next).moneyMillions).toBe(1800);
  });

  it("produces every Mission Event in order, all succeeding", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(
      timeline.entries
        .filter((entry) => entry.kind === "missionEvent")
        .map((entry) => [entry.title, entry.day, entry.outcome]),
    ).toEqual([
      ["Test launch", 0, "success"],
      ["Test burn", 1, "success"],
      ["Test arrival", 200, "success"],
    ]);
  });

  it("keeps the whole timeline in date order", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        assets: [
          {
            ...files.assets[0],
            missionEvents: ["test-arrival", "test-settle"],
          },
          ...files.assets.slice(1),
        ],
        missionEvents: [
          ...files.missionEvents,
          {
            id: "test-settle",
            name: "Test settle",
            description: "Settles into orbit.",
            failureDescription: "It tumbled out of orbit.",
            timing: { from: "arrival", days: 5 },
            failureProbability: 0,
            publicSupportLoss: 10,
          },
        ],
      } as CatalogueFiles),
    );
    const { timeline } = simulation.runTurn(
      simulation.startProgram(1),
      sendOrbiter,
    );
    const days = timeline.entries.map((entry) => entry.day);
    expect(days).toEqual(days.toSorted((first, second) => first - second));
    expect(days.at(-1)).toBe(205);
  });

  it("describes the journey for Mission Mode to show", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.startDate).toBe("2028-12-01");
    expect(timeline.durationDays).toBe(780);
    expect(timeline.mission).toEqual({
      launchDay: 0,
      arrivalDay: 200,
      launchVehicleName: "Test Vehicle",
      assetNames: ["Test Orbiter"],
      failedOnDay: null,
    });
  });

  it("tells Mission Mode which Assets were already operating when the Turn began", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    expect(first.timeline.operatingAssetNames).toEqual([]);
    const second = simulation.runTurn(first.program, sendOrbiter);
    expect(second.timeline.operatingAssetNames).toEqual(["Test Orbiter"]);
  });

  it("leaves the orbiter operating at Mars in later Turns", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter).program;
    const second = simulation.runTurn(first, sendOrbiter).program;
    expect(simulation.readProgram(second).operatingAssets).toEqual([
      {
        assetId: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        arrivedOn: "2029-06-19",
      },
      {
        assetId: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        arrivedOn: "2031-08-08",
      },
    ]);
  });

  it("moves the date on to the next Launch Window, about 26 months later", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(next);
    expect(view.turnNumber).toBe(2);
    expect(view.date).toBe("2031-01-20");
  });
});

describe("Milestones", () => {
  it("awards the Milestone's Science and Public Support when the first orbiter arrives", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(next);
    expect(view.science).toBe(100);
    expect(view.publicSupport).toBe(255);
    expect(view.milestones.map((milestone) => milestone.name)).toEqual([
      "First orbiter",
    ]);
  });

  it("starts a Program with no Science and no Milestones", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.science).toBe(0);
    expect(view.milestones).toEqual([]);
  });

  it("doesn't award the same Milestone for a second orbiter", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const second = simulation.runTurn(first.program, sendOrbiter);
    const view = simulation.readProgram(second.program);
    expect(view.science).toBe(100);
    expect(view.milestones).toHaveLength(1);
    expect(second.summary.milestones).toEqual([]);
    expect(
      second.timeline.entries.filter((entry) => entry.kind === "milestone"),
    ).toEqual([]);
  });

  it("appears on the timeline after the arrival that earned it", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.entries.map((entry) => [entry.title, entry.day])).toEqual([
      ["Test launch", 0],
      ["Test burn", 1],
      ["Test arrival", 200],
      ["First orbiter", 200],
      ["Funding Threshold reached: 300 Public Support", 200],
    ]);
  });

  it("is reported in the Turn summary with the Turn's other changes", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary).toMatchObject({
      missionCostMillions: 500,
      moneyStartMillions: 2000,
      // Less the Mission's $500M, plus the $1B Funding Threshold payout.
      moneyEndMillions: 2500,
      scienceGained: 100,
      publicSupportStart: 100,
      publicSupportEnd: 255,
      milestones: [{ name: "First orbiter", science: 100, publicSupport: 200 }],
    });
  });

  it("awards a Milestone for each kind of Asset that arrives", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "test-relay"],
      },
    });
    expect(simulation.readProgram(next).science).toBe(110);
  });
});

const skipTurn: TurnPlan = { mission: null };

describe("Funding Thresholds", () => {
  const sendRelay: TurnPlan = {
    mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
  };

  function withThresholds(
    fundingThresholds: { publicSupport: number; payoutMillions: number }[],
  ) {
    const simulation = createSimulation(
      parseCatalogue({ ...testCatalogueFiles(), fundingThresholds }),
    );
    return { simulation, program: simulation.startProgram(1) };
  }

  it("pays out when a Milestone takes Public Support to the threshold", () => {
    const { simulation, program } = setup();
    const { program: next, summary } = simulation.runTurn(program, sendOrbiter);
    // $2B, less $500M for the Mission, plus $1B from reaching 300.
    expect(simulation.readProgram(next).moneyMillions).toBe(2500);
    expect(summary.moneyEndMillions).toBe(2500);
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 300, payoutMillions: 1000 },
    ]);
  });

  it("appears on the timeline after the Milestone that caused it", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.entries.at(-1)).toMatchObject({
      kind: "fundingThreshold",
      day: 200,
    });
    expect(timeline.entries.at(-1)?.description).toContain("$1B");
  });

  it("doesn't pay when Public Support stays short of the threshold", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendRelay);
    expect(summary.fundingPayouts).toEqual([]);
  });

  it("pays nothing when Public Support falls below a threshold and reaches it again", () => {
    const { simulation, program } = setup();
    // 100 + 200 reaches 300, which pays, and then drains to 255.
    const first = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(first.program).publicSupport).toBe(255);
    // 255 + 100 is back above 300.
    const second = simulation.runTurn(first.program, sendRelay);
    expect(second.summary.publicSupportGained).toBe(100);
    expect(second.summary.fundingPayouts).toEqual([]);
    expect(simulation.readProgram(second.program).moneyMillions).toBe(2300);
  });

  it("pays each threshold once when one award crosses several", () => {
    const { simulation, program } = withThresholds([
      { publicSupport: 150, payoutMillions: 10 },
      { publicSupport: 250, payoutMillions: 20 },
      { publicSupport: 500, payoutMillions: 40 },
    ]);
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 150, payoutMillions: 10 },
      { publicSupport: 250, payoutMillions: 20 },
    ]);
    expect(summary.moneyEndMillions).toBe(2000 - 500 + 30);
  });

  it("tells Planning Mode about the next threshold and how far away it is", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).nextFundingThreshold).toEqual({
      publicSupport: 300,
      payoutMillions: 1000,
      pointsAway: 200,
    });
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).nextFundingThreshold).toEqual({
      publicSupport: 1000,
      payoutMillions: 7000,
      pointsAway: 745,
    });
  });

  it("reports no next threshold when they have all been paid", () => {
    const { simulation, program } = withThresholds([
      { publicSupport: 300, payoutMillions: 1000 },
    ]);
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).nextFundingThreshold).toBeNull();
  });
});

describe("a Turn without a Mission", () => {
  it("still moves on to the next Launch Window, spending nothing", () => {
    const { simulation, program } = setup();
    const { program: next, timeline } = simulation.runTurn(program, skipTurn);
    const view = simulation.readProgram(next);
    expect(view.turnNumber).toBe(2);
    expect(view.date).toBe("2031-01-20");
    expect(view.moneyMillions).toBe(2000);
    expect(timeline.mission).toBeNull();
    expect(timeline.entries).toEqual([]);
    expect(timeline.durationDays).toBe(780);
  });

  it("is a valid plan even with no money", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, skipTurn)).toEqual({
      costMillions: 0,
      problems: [],
    });
  });
});

describe("Public Support drain", () => {
  it("falls by the configured percentage each Turn", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, skipTurn).program;
    expect(simulation.readProgram(first).publicSupport).toBe(85);
    const second = simulation.runTurn(first, skipTurn).program;
    expect(simulation.readProgram(second).publicSupport).toBe(72);
  });

  it("is shown in the Turn summary", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary).toMatchObject({
      publicSupportStart: 100,
      publicSupportGained: 200,
      publicSupportDrained: 45,
      publicSupportEnd: 255,
    });
  });
});

describe("cancellation", () => {
  function skipUntilEnded(start: { simulation: Simulation; program: Program }) {
    const { simulation } = start;
    let { program } = start;
    let turns = 0;
    while (simulation.readProgram(program).status.kind === "active") {
      program = simulation.runTurn(program, skipTurn).program;
      turns += 1;
      expect(turns).toBeLessThan(1000);
    }
    return { program, turns };
  }

  it("ends a Program that only skips Turns, with the reason", () => {
    const start = setup();
    const { program, turns } = skipUntilEnded(start);
    // 100, 85, 72, 61, 51, then 43, which is below the Cancellation Level of 50.
    expect(turns).toBe(5);
    const { status, publicSupport } = start.simulation.readProgram(program);
    expect(publicSupport).toBe(43);
    expect(status).toEqual({
      kind: "cancelled",
      reason: "Public Support fell to 43, below the Cancellation Level of 50.",
    });
  });

  it("doesn't cancel at exactly the Cancellation Level", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, cancellationLevel: 85 },
      }),
    );
    const { program } = simulation.runTurn(
      simulation.startProgram(1),
      skipTurn,
    );
    expect(simulation.readProgram(program).status.kind).toBe("active");
  });

  it("ends even a Program whose Public Support drains very slowly", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: {
          ...files.program,
          publicSupportDrainPercent: 1,
          cancellationLevel: 1,
        },
      }),
    );
    const { turns } = skipUntilEnded({
      simulation,
      program: simulation.startProgram(1),
    });
    expect(turns).toBeGreaterThan(5);
  });

  it("reports the cancellation in the Turn summary", () => {
    const { simulation } = setup();
    let program = simulation.startProgram(1);
    for (let turn = 0; turn < 4; turn++) {
      program = simulation.runTurn(program, skipTurn).program;
    }
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(summary.cancellationReason).toContain("Cancellation Level");
  });

  it("doesn't let an ended Program run another Turn", () => {
    const start = setup();
    const { program } = skipUntilEnded(start);
    expect(() => start.simulation.runTurn(program, skipTurn)).toThrow(
      /has ended/,
    );
  });
});

describe("a Mission Event failing", () => {
  /** A Simulation in which the named Mission Events have the given failure probabilities. */
  function withFailures(probabilities: Record<string, number>) {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: probabilities[event.id] ?? 0,
        })),
      }),
    );
    return { simulation, program: simulation.startProgram(42) };
  }

  it("ends the Mission at the first failure, so later Mission Events don't happen", () => {
    const { simulation, program } = withFailures({ "test-burn": 1 });
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(
      timeline.entries.map((entry) =>
        entry.kind === "missionEvent" ? [entry.eventId, entry.outcome] : null,
      ),
    ).toEqual([
      ["test-launch", "success"],
      ["test-burn", "failure"],
    ]);
  });

  it("takes the first failure in time, whichever way the catalogue lists the Mission Events", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        launchVehicles: [
          {
            id: "test-vehicle",
            name: "Test Vehicle",
            costMillions: 100,
            missionEvents: ["test-burn", "test-launch"],
          },
        ],
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 1,
        })),
      }),
    );
    const { summary } = simulation.runTurn(
      simulation.startProgram(1),
      sendOrbiter,
    );
    expect(summary.failure?.missionEventName).toBe("Test launch");
  });

  it("describes the failure on the timeline, with what it cost", () => {
    const { simulation, program } = withFailures({ "test-burn": 1 });
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    const entry = timeline.entries.at(-1);
    expect(entry?.title).toBe("Test burn failed");
    expect(entry?.description).toContain("The engine cut out.");
    expect(entry?.description).toContain("Test Orbiter");
    expect(entry?.description).toContain("30 Public Support");
  });

  it("tells Mission Mode the day the journey stopped", () => {
    const { simulation, program } = withFailures({ "test-burn": 1 });
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.mission?.failedOnDay).toBe(1);
  });

  it("loses the Mission's Assets", () => {
    const { simulation, program } = withFailures({ "test-arrival": 1 });
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).operatingAssets).toEqual([]);
  });

  it("keeps the money spent and earns no Milestone, Science or Funding Threshold payout", () => {
    const { simulation, program } = withFailures({ "test-arrival": 1 });
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(next);
    expect(view.moneyMillions).toBe(1500);
    expect(view.science).toBe(0);
    expect(view.milestones).toEqual([]);
    expect(summary.milestones).toEqual([]);
    expect(summary.fundingPayouts).toEqual([]);
    expect(timeline.entries.map((entry) => entry.kind)).toEqual([
      "missionEvent",
      "missionEvent",
      "missionEvent",
    ]);
  });

  it("can still earn the Milestone on a later Mission", () => {
    const { simulation, program } = withFailures({ "test-arrival": 1 });
    const failed = simulation.runTurn(program, sendOrbiter).program;
    const files = testCatalogueFiles();
    const reliable = createSimulation(parseCatalogue(files));
    const { summary } = reliable.runTurn(failed, sendOrbiter);
    expect(summary.milestones.map(({ name }) => name)).toEqual([
      "First orbiter",
    ]);
  });

  it("takes the Public Support loss before the percentage drain", () => {
    const { simulation, program } = withFailures({ "test-launch": 1 });
    const { program: next, summary } = simulation.runTurn(program, sendOrbiter);
    // 100, less 20 for the failure, less 15% of the 80 that leaves.
    expect(simulation.readProgram(next).publicSupport).toBe(68);
    expect(summary).toMatchObject({
      publicSupportStart: 100,
      publicSupportDrained: 12,
      publicSupportEnd: 68,
      failure: {
        missionEventName: "Test launch",
        assetsLost: ["Test Orbiter"],
        publicSupportLost: 20,
      },
    });
  });

  it("never takes Public Support below zero", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 1,
          publicSupportLoss: 500,
        })),
      }),
    );
    const { summary } = simulation.runTurn(
      simulation.startProgram(1),
      sendOrbiter,
    );
    expect(summary.publicSupportEnd).toBe(0);
    expect(summary.failure?.publicSupportLost).toBe(100);
  });

  it("can trigger cancellation through the Public Support it loses", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 1,
          publicSupportLoss: 50,
        })),
      }),
    );
    const { program, summary } = simulation.runTurn(
      simulation.startProgram(1),
      sendOrbiter,
    );
    // 100 less 50 is exactly the Cancellation Level, but the drain then takes it below.
    expect(summary.publicSupportEnd).toBe(42);
    expect(simulation.readProgram(program).status.kind).toBe("cancelled");
  });

  it("reports no failure for a Mission that succeeds, or a Turn without one", () => {
    const { simulation, program } = setup();
    expect(simulation.runTurn(program, sendOrbiter).summary.failure).toBeNull();
    expect(simulation.runTurn(program, skipTurn).summary.failure).toBeNull();
  });
});

describe("failure rolls", () => {
  const seeds = Array.from({ length: 500 }, (_, index) => index + 1);

  function catalogueWith(probabilities: Record<string, number>) {
    const files = testCatalogueFiles();
    return createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: probabilities[event.id] ?? 0,
        })),
      }),
    );
  }

  /** Which Mission Event failed for each seed, or null if the Mission succeeded. */
  function failuresBySeed(simulation: Simulation) {
    return seeds.map(
      (seed) =>
        simulation.runTurn(simulation.startProgram(seed), sendOrbiter).summary
          .failure?.missionEventName ?? null,
    );
  }

  it("give the same outcome for the same seed and plans", () => {
    const simulation = catalogueWith({
      "test-launch": 0.5,
      "test-arrival": 0.5,
    });
    expect(failuresBySeed(simulation)).toEqual(failuresBySeed(simulation));
  });

  it("happen about as often as the failure probability says", () => {
    const failures = failuresBySeed(catalogueWith({ "test-burn": 0.2 })).filter(
      Boolean,
    );
    expect(failures.length).toBeGreaterThan(70);
    expect(failures.length).toBeLessThan(130);
  });

  it("don't change for one Mission Event when another's probability changes", () => {
    const failedBurn = (launchProbability: number) => {
      const simulation = catalogueWith({
        "test-launch": launchProbability,
        "test-burn": 0.5,
      });
      return failuresBySeed(simulation).map((name) => name === "Test burn");
    };
    const withoutLaunchRisk = failedBurn(0);
    const withLaunchRisk = failedBurn(0.3);
    // A launch failure hides the burn, so compare only where the launch went well in both.
    const launchFailed = failuresBySeed(
      catalogueWith({ "test-launch": 0.3 }),
    ).map((name) => name === "Test launch");
    seeds.forEach((_, index) => {
      if (!launchFailed[index]) {
        expect(withLaunchRisk[index]).toBe(withoutLaunchRisk[index]);
      }
    });
    expect(launchFailed.filter(Boolean).length).toBeGreaterThan(0);
  });

  it("differ between Turns, so a retry isn't doomed to repeat a failure", () => {
    const simulation = catalogueWith({ "test-launch": 0.5 });
    const differs = seeds.some((seed) => {
      const first = simulation.runTurn(
        simulation.startProgram(seed),
        skipTurn,
      ).program;
      const fromTurnOne = simulation.runTurn(
        simulation.startProgram(seed),
        sendOrbiter,
      ).summary.failure;
      const fromTurnTwo = simulation.runTurn(first, sendOrbiter).summary
        .failure;
      return (fromTurnOne === null) !== (fromTurnTwo === null);
    });
    expect(differs).toBe(true);
  });
});

describe("retirement", () => {
  it("ends the Program and keeps its Science and Milestones", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(simulation.retireProgram(flown));
    expect(view.status).toEqual({ kind: "retired" });
    expect(view.science).toBe(100);
    expect(view.milestones.map((milestone) => milestone.name)).toEqual([
      "First orbiter",
    ]);
  });

  it("reports any plan for an ended Program as a problem", () => {
    const { simulation, program } = setup();
    const retired = simulation.retireProgram(program);
    expect(simulation.validatePlan(retired, skipTurn).problems).toEqual([
      "This Program has ended.",
    ]);
  });

  it("doesn't let a retired Program run another Turn", () => {
    const { simulation, program } = setup();
    const retired = simulation.retireProgram(program);
    expect(() => simulation.runTurn(retired, skipTurn)).toThrow(/has ended/);
  });
});

describe("time and determinism", () => {
  it("passes no game time while planning", () => {
    const { simulation, program } = setup();
    simulation.validatePlan(program, sendOrbiter);
    simulation.readProgram(program);
    expect(simulation.readProgram(program).date).toBe("2028-12-01");
  });

  it("gives the same result for the same seed and plans", () => {
    const play = () => {
      const { simulation, program } = setup();
      const first = simulation.runTurn(program, sendOrbiter);
      return [first, simulation.runTurn(first.program, sendOrbiter)];
    };
    expect(play()).toEqual(play());
  });

  it("doesn't change the Program passed in", () => {
    const { simulation, program } = setup();
    const before = structuredClone(program);
    simulation.runTurn(program, sendOrbiter);
    expect(program).toEqual(before);
  });
});
