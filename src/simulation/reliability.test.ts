import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Simulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup } from "./testHelpers";

describe("previewing a Mission's risk", () => {
  function withEvents(probabilities: Record<string, number>) {
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

  it("lists every Mission Event the Mission will go through, in order", () => {
    const { simulation } = setup();
    expect(
      simulation
        .previewMission(simulation.startProgram(42), {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
        })
        .map((event) => event.name),
    ).toEqual(["Test launch", "Test burn", "Test arrival"]);
  });

  it("changes with what the Mission carries", () => {
    const { simulation } = setup();
    expect(
      simulation
        .previewMission(simulation.startProgram(42), {
          launchVehicleId: "test-vehicle",
          assetIds: [],
        })
        .map((event) => event.name),
    ).toEqual(["Test launch", "Test burn"]);
  });

  it("lists a Mission Event once when several things share it", () => {
    const { simulation } = setup();
    expect(
      simulation.previewMission(simulation.startProgram(42), {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "test-relay"],
      }),
    ).toHaveLength(3);
  });

  it.each([
    [0, "~1%"],
    [0.01, "~1%"],
    [0.02, "~5%"],
    [0.05, "~5%"],
    [0.3, "Over 10%"],
    [1, "Over 10%"],
  ])(
    "shows a failure probability of %s as the band %s",
    (probability, band) => {
      const simulation = withEvents({ "test-launch": probability });
      const [launch] = simulation.previewMission(simulation.startProgram(42), {
        launchVehicleId: "test-vehicle",
        assetIds: [],
      });
      expect(launch?.riskBand).toBe(band);
    },
  );

  it("never exposes the exact probability", () => {
    const simulation = withEvents({ "test-launch": 0.0437 });
    const preview = simulation.previewMission(simulation.startProgram(42), {
      launchVehicleId: "test-vehicle",
      assetIds: [],
    });
    expect(JSON.stringify(preview)).not.toContain("0.0437");
    expect(preview[0]).not.toHaveProperty("failureProbability");
  });
});

describe("Reliability", () => {
  const allEvents = (levelId: string) => ({
    "test-launch": levelId,
    "test-burn": levelId,
    "test-arrival": levelId,
  });

  function planWith(reliability: Record<string, string>): TurnPlan {
    return {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        reliability,
      },
    };
  }

  function riskyCatalogue(probability: number) {
    const files = testCatalogueFiles();
    return createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: probability,
        })),
      }),
    );
  }

  const seeds = Array.from({ length: 1000 }, (_, index) => index + 1);

  function failedEvent(
    simulation: Simulation,
    seed: number,
    plan: TurnPlan,
  ): string | null {
    return (
      simulation.runTurn(simulation.startProgram(seed), plan).summary.failure
        ?.missionEventName ?? null
    );
  }

  it("offers every level for each Mission Event, defaulting to the cheapest", () => {
    const { simulation } = setup();
    const [launch] = simulation.previewMission(simulation.startProgram(42), {
      launchVehicleId: "test-vehicle",
      assetIds: ["test-orbiter"],
    });
    expect(launch?.reliabilityLevelId).toBe("none");
    expect(launch?.reliabilityLevels.map((level) => level.name)).toEqual([
      "None",
      "Tested",
      "Redundant",
    ]);
  });

  it("moves a Mission Event's risk band when its level changes, and no other's", () => {
    const simulation = riskyCatalogue(0.08);
    const preview = simulation.previewMission(simulation.startProgram(42), {
      launchVehicleId: "test-vehicle",
      assetIds: ["test-orbiter"],
      reliability: { "test-launch": "redundant" },
    });
    expect(preview.map((event) => event.riskBand)).toEqual([
      "~1%",
      "~10%",
      "~10%",
    ]);
  });

  it("adds each level's cost to the Mission's total cost", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(
        program,
        planWith({ "test-launch": "tested", "test-burn": "redundant" }),
      ),
    ).toMatchObject({ costMillions: 750, problems: [] });
  });

  it("spends the money", () => {
    const { simulation, program } = setup();
    const { program: next, summary } = simulation.runTurn(
      program,
      planWith({ "test-arrival": "redundant" }),
    );
    expect(summary.missionCostMillions).toBe(700);
    // Less $700M, plus the $1B Funding Threshold payout.
    expect(simulation.readProgram(next).moneyMillions).toBe(2300);
  });

  it("rejects a plan Reliability makes unaffordable", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, startingMoneyMillions: 600 },
      }),
    );
    const program = simulation.startProgram(1);
    expect(simulation.validatePlan(program, sendOrbiter).problems).toEqual([]);
    const { problems } = simulation.validatePlan(
      program,
      planWith(allEvents("tested")),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/\$650M.*\$600M/);
  });

  it("rejects an unknown level with a clear reason", () => {
    const { simulation, program } = setup();
    const plan = planWith({ "test-launch": "gold-plated" });
    const { problems } = simulation.validatePlan(program, plan);
    expect(problems.join(" ")).toContain('"gold-plated"');
    expect(() => simulation.runTurn(program, plan)).toThrow(/gold-plated/);
  });

  it("rejects a level for a Mission Event the Mission doesn't go through", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(
      program,
      planWith({ "no-such-event": "tested" }),
    );
    expect(problems.join(" ")).toContain('"no-such-event"');
  });

  it("never turns a success into a failure, for any seed", () => {
    const simulation = riskyCatalogue(0.3);
    for (const seed of seeds) {
      const without = failedEvent(simulation, seed, sendOrbiter);
      if (without === null) {
        expect(
          failedEvent(simulation, seed, planWith(allEvents("redundant"))),
        ).toBeNull();
      }
    }
  });

  it("doesn't change the roll of any other Mission Event", () => {
    const simulation = riskyCatalogue(0.3);
    for (const seed of seeds) {
      const without = failedEvent(simulation, seed, sendOrbiter);
      // Protecting only the arrival can't change whether the two before it fail.
      const withArrivalBought = failedEvent(
        simulation,
        seed,
        planWith({ "test-arrival": "redundant" }),
      );
      if (without === "Test launch" || without === "Test burn") {
        expect(withArrivalBought).toBe(without);
      } else {
        expect(["Test arrival", null]).toContain(withArrivalBought);
      }
    }
  });

  it("produces fewer failures at each higher level, over many seeds", () => {
    const simulation = riskyCatalogue(0.3);
    const failures = (levelId: string) =>
      seeds.filter(
        (seed) =>
          failedEvent(simulation, seed, planWith(allEvents(levelId))) !== null,
      ).length;
    const none = failures("none");
    const tested = failures("tested");
    const redundant = failures("redundant");
    expect(tested).toBeLessThan(none);
    expect(redundant).toBeLessThan(tested);
    // 1 - 0.97^3 of 1000 is about 87, so this isn't just "any drop".
    expect(redundant).toBeLessThan(150);
  });

  it("doesn't carry over to the next Turn's plan", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(
      program,
      planWith(allEvents("redundant")),
    );
    expect(simulation.validatePlan(next, sendOrbiter).costMillions).toBe(500);
    expect(
      simulation
        .previewMission(simulation.startProgram(42), {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
        })
        .map((event) => event.reliabilityLevelId),
    ).toEqual(["none", "none", "none"]);
  });
});
