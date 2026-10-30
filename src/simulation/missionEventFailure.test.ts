import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Simulation } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup, skipTurn } from "./testHelpers";

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
