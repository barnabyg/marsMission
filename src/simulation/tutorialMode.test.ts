import { describe, expect, it } from "vitest";
import { createSimulation } from "./simulation";
import { testCatalogue } from "./testCatalogue";
import { sendOrbiter, setup } from "./testHelpers";

describe("tutorial mode", () => {
  it("is off unless the Program starts with it", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).tutorial).toEqual({ kind: "off" });
    const tutored = simulation.startProgram(42, { tutorial: true });
    expect(simulation.readProgram(tutored).tutorial).toEqual({ kind: "on" });
  });

  it("can be turned off and back on while it hasn't ended", () => {
    const { simulation } = setup();
    const tutored = simulation.startProgram(42, { tutorial: true });
    const off = simulation.setTutorial(tutored, false);
    expect(simulation.readProgram(off).tutorial).toEqual({ kind: "off" });
    const on = simulation.setTutorial(off, true);
    expect(simulation.readProgram(on).tutorial).toEqual({ kind: "on" });
  });

  it("stays as it is through a Turn", () => {
    const { simulation } = setup();
    const tutored = simulation.startProgram(42, { tutorial: true });
    const next = simulation.runTurn(tutored, sendOrbiter).program;
    expect(simulation.readProgram(next).tutorial).toEqual({ kind: "on" });
  });

  it("records how it ended, after which it can't be turned on again", () => {
    const { simulation } = setup();
    const tutored = simulation.startProgram(42, { tutorial: true });
    const ended = simulation.endTutorial(tutored, "cantRecover");
    expect(simulation.readProgram(ended).tutorial).toEqual({
      kind: "ended",
      outcome: "cantRecover",
    });
    expect(() => simulation.setTutorial(ended, true)).toThrow(/ended/);
    expect(() => simulation.setTutorial(ended, false)).toThrow(/ended/);
  });

  it("can only end while it is on", () => {
    const { simulation, program } = setup();
    expect(() => simulation.endTutorial(program, "goalReached")).toThrow(
      /isn't on/,
    );
  });

  it.each([
    { kind: "on" as const, make: (on: boolean) => on },
    { kind: "off" as const, make: (on: boolean) => !on },
  ])("is kept in a save while $kind", ({ kind, make }) => {
    const { simulation } = setup();
    const program = simulation.startProgram(42, { tutorial: make(true) });
    const saved = JSON.parse(
      JSON.stringify(simulation.saveProgram(program)),
    ) as unknown;
    const restored = simulation.restoreProgram(saved);
    expect(simulation.readProgram(restored).tutorial).toEqual({ kind });
  });

  it("keeps in a save that it has ended, and how", () => {
    const { simulation } = setup();
    const ended = simulation.endTutorial(
      simulation.startProgram(42, { tutorial: true }),
      "goalReached",
    );
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(ended))) as unknown,
    );
    expect(simulation.readProgram(restored).tutorial).toEqual({
      kind: "ended",
      outcome: "goalReached",
    });
  });
});

describe("saves from before tutorial mode", () => {
  it("upgrades a save from before tutorial mode with it off", () => {
    const simulation = createSimulation(testCatalogue());
    // A literal copy of what format 12 looks like. Don't change this: it's a compatibility contract.
    const formatTwelve = {
      formatVersion: 12,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: [],
        landedSiteIds: [],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [],
        crew: [],
        crewActivities: {},
        crewSupplies: {},
        earthReturnStages: [],
        ascentPropellantKg: {},
        habitatSuppliesKg: {},
        samplesAtSites: {},
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatTwelve);
    expect(simulation.readProgram(restored).tutorial).toEqual({ kind: "off" });
    expect(simulation.saveProgram(restored).formatVersion).toBeGreaterThan(12);
  });
});
