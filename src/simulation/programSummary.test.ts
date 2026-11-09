import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import {
  sendOrbiter,
  setup,
  skipTurn,
  steadyHealth,
  withFailures,
} from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};

describe("the Program summary", () => {
  it("says a Program retired before its first Turn played none, and which seed it used", () => {
    const { simulation, program } = setup();
    const summary = simulation.summariseProgram(
      simulation.retireProgram(program),
    );
    expect(summary).toMatchObject({
      status: { kind: "retired" },
      seed: 42,
      turnsPlayed: 0,
      years: 0,
      missionsLaunched: 0,
      missionsLost: 0,
      science: 0,
      peakPublicSupport: 100,
      milestones: [],
      crew: { flown: 0, home: 0, lost: 0 },
      samplesHome: 0,
      countedFromTurn: 1,
    });
  });

  it("counts the Turns played and the years they took, the Missions launched and lost, and the Turn each Milestone was earned", () => {
    const { simulation, program } = setup();
    const failing = withFailures(["test-launch"]).simulation;
    const first = simulation.runTurn(program, sendOrbiter).program;
    const second = failing.runTurn(first, sendOrbiter).program;
    const third = simulation.runTurn(second, skipTurn).program;
    const summary = simulation.summariseProgram(
      simulation.retireProgram(third),
    );
    expect(summary).toMatchObject({
      turnsPlayed: 3,
      // Three launch windows 780 days apart.
      years: 6,
      missionsLaunched: 2,
      missionsLost: 1,
      science: simulation.readProgram(third).science,
      moneyMillions: simulation.readProgram(third).moneyMillions,
    });
    expect(summary.milestones).toEqual([
      {
        name: "First orbiter",
        description: "An orbiter reached Mars.",
        science: 100,
        publicSupport: 200,
        turn: 1,
      },
    ]);
  });

  it("keeps the highest Public Support any Turn ended with", () => {
    const { simulation, program } = setup();
    const failing = withFailures(["test-launch"]).simulation;
    const first = simulation.runTurn(program, sendOrbiter).program;
    const high = simulation.readProgram(first).publicSupport;
    const later = failing.runTurn(first, sendOrbiter).program;
    expect(simulation.readProgram(later).publicSupport).toBeLessThan(high);
    expect(simulation.summariseProgram(later).peakPublicSupport).toBe(high);
  });

  it("counts the Crew who flew, came home and were lost", () => {
    const freeReturn: TurnPlan = {
      mission: { ...crewMission, trajectoryId: "test-free-return" },
    };
    const home = withFailures(["test-arrival"], {
      crewHealth: steadyHealth,
      startingMoneyMillions: 20000,
    });
    const lost = withFailures(["test-launch"]).simulation;
    const first = home.simulation.runTurn(home.program, freeReturn).program;
    const second = lost.runTurn(first, { mission: crewMission }).program;
    expect(home.simulation.summariseProgram(second).crew).toEqual({
      flown: 4,
      home: 2,
      lost: 2,
    });
  });

  it("counts the samples brought home", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
    });
    const cached = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-rover", "test-ascent-vehicle", "test-return-orbiter"],
        landingSiteId: "alpha-plain",
        assetChoices: { "test-rover": { activityId: "test-caching" } },
      },
    }).program;
    const home = simulation.runTurn(cached, {
      mission: null,
      bringHome: "samples:alpha-plain",
    }).program;
    // The Test Rover caches 15 on the first Turn, which fly home on the second.
    expect(simulation.summariseProgram(home).samplesHome).toBe(15);
  });

  it("counts from the Turn it was saved on for a save made before the summary kept a record", () => {
    const { simulation } = setup();
    const program = simulation.restoreProgram({
      formatVersion: 1,
      program: {
        seed: 42,
        turnNumber: 3,
        date: "2033-03-10",
        moneyMillions: 1250,
        publicSupport: 180,
        science: 100,
        milestoneIds: ["first-orbiter"],
        fundingThresholdsPaid: [300],
        operatingAssets: [],
        status: { kind: "active" },
      },
    });
    const summary = simulation.summariseProgram(
      simulation.runTurn(program, skipTurn).program,
    );
    expect(summary).toMatchObject({
      turnsPlayed: 3,
      countedFromTurn: 3,
      missionsLaunched: 0,
      peakPublicSupport: 180,
    });
    expect(summary.milestones).toEqual([
      expect.objectContaining({ name: "First orbiter", turn: null }),
    ]);
  });
});
