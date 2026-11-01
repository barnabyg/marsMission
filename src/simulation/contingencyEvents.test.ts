import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";

describe("Contingencies for other Mission Events", () => {
  /** A Simulation whose named Mission Events always fail, with no risk at any Landing Site otherwise. */
  function failing(ids: string[], rescueFailureProbability = 0) {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, startingMoneyMillions: 5000 },
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: ids.includes(event.id) ? 1 : 0,
        })),
        contingencies: files.contingencies.map((contingency) => ({
          ...contingency,
          rescueFailureProbability,
        })),
      }),
    );
    return { simulation, program: simulation.startProgram(42) };
  }

  const landing = "contingency:test-landing";
  const burn = "contingency:test-burn";
  const arrival = "contingency:test-arrival";
  const landerAndRover: TurnPlan = {
    mission: {
      launchVehicleId: "test-heavy",
      assetIds: ["test-lander", "test-rover"],
      landingSiteId: "alpha-plain",
      contingencyIds: ["test-thrusters"],
    },
  };

  it("makes a rescued landing a hard landing, which earns what any landing earns", () => {
    const { simulation, program } = failing(["test-landing"]);
    const lander: TurnPlan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
        contingencyIds: ["test-thrusters"],
      },
    };
    const {
      summary,
      timeline,
      program: next,
    } = simulation.runTurn(program, lander, { [landing]: "use" });
    expect(summary.firstLanding).toEqual({
      siteName: "Alpha Plain",
      science: 50,
    });
    expect(summary.milestones.map(({ name }) => name)).toEqual([
      "First landing",
    ]);
    expect(simulation.readProgram(next).operatingAssets).toMatchObject([
      { landingSiteName: "Alpha Plain", serviceLifeDays: 40_000 },
    ]);
    expect(timeline.mission?.assets[0]).toMatchObject({
      deliveredOnDay: 205,
      lostOnDay: null,
      crashed: false,
    });
    expect(
      timeline.entries.filter(({ day }) => day === 205).map(({ kind }) => kind),
    ).toEqual(expect.arrayContaining(["decisionPoint", "missionEvent"]));
  });

  it("fills in what is landing and where in what it says", () => {
    const { simulation, program } = failing(["test-landing"]);
    const stopped = simulation.workOutTurn(program, landerAndRover);
    expect(stopped.decisionPoint?.description).toBe(
      "The lander and the rover came in too fast at Alpha Plain.",
    );
  });

  it("gives a rover and a lander on one Mission one Decision Point and one outcome", () => {
    const { simulation, program } = failing(["test-landing"]);
    const stopped = simulation.workOutTurn(program, landerAndRover);
    expect(stopped.decisionPoint?.use.description).toContain(
      "Test Lander, Test Rover",
    );
    const { summary } = simulation.runTurn(program, landerAndRover, {
      [landing]: "use",
    });
    expect(summary.contingencies).toHaveLength(1);
    expect(summary.contingencies[0]?.assets).toEqual([
      { name: "Test Lander", serviceLifeDays: 40_000 },
      { name: "Test Rover", serviceLifeDays: 40_000 },
    ]);
    const crashed = failing(["test-landing"], 1);
    const lost = crashed.simulation.runTurn(crashed.program, landerAndRover, {
      [landing]: "use",
    });
    expect(lost.summary.failure?.assetsLost).toEqual([
      "Test Lander",
      "Test Rover",
    ]);
    expect(lost.timeline.mission?.assets.map(({ crashed: c }) => c)).toEqual([
      true,
      true,
    ]);
  });

  it("carries a rescued transfer burn on to Mars", () => {
    const { simulation, program } = failing(["test-burn"]);
    const { summary, timeline } = simulation.runTurn(
      program,
      {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
          contingencyIds: ["test-spare-engine"],
        },
      },
      { [burn]: "use" },
    );
    expect(summary.failure).toBeNull();
    expect(timeline.entries.map(({ title }) => title).slice(0, 4)).toEqual([
      "Test launch",
      "Test burn: Decision Point",
      "Test burn: saved by Spare engine",
      "Test arrival",
    ]);
    expect(timeline.mission?.assets[0]?.deliveredOnDay).toBe(200);
  });

  it("can meet several Decision Points in a Turn, one at a time, with their cuts adding up", () => {
    const { simulation, program } = failing(["test-burn", "test-arrival"]);
    const plan: TurnPlan = {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter"],
        contingencyIds: ["test-spare-engine", "test-reserve-fuel"],
      },
    };
    const first = simulation.workOutTurn(program, plan);
    expect(first.decisionPoint?.id).toBe(burn);
    const second = simulation.workOutTurn(program, plan, { [burn]: "use" });
    expect(second.decisionPoint?.id).toBe(arrival);
    expect(second.timeline.decisionDay).toBe(200);
    const { summary, program: next } = simulation.runTurn(program, plan, {
      [burn]: "use",
      [arrival]: "use",
    });
    expect(summary.contingencies.map(({ rescued }) => rescued)).toEqual([
      true,
      true,
    ]);
    // 50,000 days, less 10%, and then less 50% of what's left.
    expect(simulation.readProgram(next).operatingAssets).toMatchObject([
      { serviceLifeDays: 22_500 },
    ]);
  });

  it("leaves an Asset already delivered alone, and it stays safe either way", () => {
    const { simulation, program } = failing(["test-landing"]);
    const plan: TurnPlan = {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter", "test-lander"],
        landingSiteId: "alpha-plain",
        contingencyIds: ["test-thrusters"],
      },
    };
    const stopped = simulation.workOutTurn(program, plan);
    expect(stopped.timeline.assetsAtMars.map(({ name }) => name)).toEqual([
      "Test Orbiter",
    ]);
    expect(stopped.decisionPoint?.decline.description).not.toContain(
      "Test Orbiter",
    );
    const saved = simulation.runTurn(program, plan, { [landing]: "use" });
    expect(simulation.readProgram(saved.program).operatingAssets).toMatchObject(
      [
        { name: "Test Orbiter", serviceLifeDays: 50_000 },
        { name: "Test Lander", serviceLifeDays: 40_000 },
      ],
    );
    const lost = simulation.runTurn(program, plan, { [landing]: "decline" });
    expect(lost.summary.failure?.assetsLost).toEqual(["Test Lander"]);
  });

  it("keeps the shorter Service Life through saving and reloading", () => {
    const { simulation, program } = failing(["test-arrival"]);
    const { program: next } = simulation.runTurn(
      program,
      {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
          contingencyIds: ["test-reserve-fuel"],
        },
      },
      { [arrival]: "use" },
    );
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(next))),
    );
    expect(simulation.readProgram(restored).operatingAssets).toMatchObject([
      { serviceLifeDays: 25_000 },
    ]);
  });
});
