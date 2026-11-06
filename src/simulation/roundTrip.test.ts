import { describe, expect, it } from "vitest";
import type { PlannedMission } from "./types";
import { setup, steadyHealth, withFailures } from "./testHelpers";

const roundTrip: PlannedMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2, roundTrip: true },
};
const oneWay: PlannedMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};

/** Crew whose Health never falls, for the tests that follow them to Mars and home. */
const lasting = () => withFailures([], { crewHealth: steadyHealth });

describe("planning a round trip", () => {
  it("offers an Earth return stage with what it adds to a Crewed Mission's cost and mass", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).crewedMission.roundTrip).toEqual({
      name: "Test return stage",
      description: "Brings the Crew home.",
      costMillions: 500,
      massTonnes: 1,
      ascentPropellantKg: 5000,
    });
  });

  it("adds the Earth return stage's cost and mass to the Mission's", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, { mission: roundTrip }),
    ).toMatchObject({
      costMillions: 300 + 1000 + 100 + 500,
      massTonnes: 6 + 1 + 1,
      problems: [],
    });
  });

  it("lists the journey home's Mission Events after the way there, with their Reliability and Contingency", () => {
    const { simulation, program } = setup();
    const events = simulation.previewMission(program, roundTrip);
    expect(events.map(({ name, homeward }) => [name, homeward])).toEqual([
      ["Test launch", false],
      ["Test burn", false],
      ["Test arrival", false],
      ["Test departure home", true],
      ["Test splashdown", true],
    ]);
    expect(
      events.find(({ eventId }) => eventId === "test-departure-home")
        ?.contingency,
    ).toMatchObject({ id: "test-backup-engine", bought: false });
    expect(
      simulation
        .previewMission(program, oneWay)
        .some(({ homeward }) => homeward),
    ).toBe(false);
  });

  it("buys Reliability and Contingency for the journey home with the round trip, at launch", () => {
    const { simulation, program } = setup();
    const careful: PlannedMission = {
      ...roundTrip,
      reliability: { "test-splashdown": "tested" },
      contingencyIds: ["test-backup-engine"],
    };
    expect(
      simulation.validatePlan(program, { mission: careful }),
    ).toMatchObject({
      costMillions: 300 + 1000 + 100 + 500 + 50 + 40,
      massTonnes: 6 + 1 + 1 + 0.5,
      problems: [],
    });
    expect(
      simulation.validatePlan(program, {
        mission: { ...careful, crew: { size: 2 } },
      }).problems,
    ).toEqual([
      "This Mission doesn't go through the Mission Event that Backup engine is for.",
      'This Mission has no Mission Event called "test-splashdown".',
    ]);
  });
});

describe("round-trip Crew at Mars", () => {
  it("wait in Mars orbit with their Earth return stage, which Planning Mode offers to bring home on a later Turn", () => {
    const { simulation, program } = lasting();
    const { program: next } = simulation.runTurn(program, {
      mission: roundTrip,
    });
    expect(simulation.readProgram(next).crew).toEqual([
      expect.objectContaining({
        key: "mars-orbit",
        waysHome: [
          {
            key: "earth-return-stage:2029-06-19",
            names: ["Ann Able", "Ben Baker"],
            leavesMarsOn: "2031-04-30",
            homeOn: "2031-11-16",
            samples: 0,
            reason: null,
          },
        ],
      }),
    ]);
  });

  it("have no way home if they went one way", () => {
    const { simulation, program } = lasting();
    const { program: next } = simulation.runTurn(program, { mission: oneWay });
    expect(simulation.readProgram(next).crew[0]?.waysHome).toEqual([]);
  });

  it("can't be brought home with a way home that isn't there", () => {
    const { simulation, program } = lasting();
    const { program: next } = simulation.runTurn(program, { mission: oneWay });
    expect(
      simulation.validatePlan(next, {
        mission: null,
        bringHome: "earth-return-stage:2029-06-19",
      }).problems,
    ).toEqual([
      'There are no Crew at Mars waiting to come home aboard "earth-return-stage:2029-06-19".',
    ]);
  });

  it("keep their way home through saving and loading", () => {
    const { simulation, program } = lasting();
    const { program: next } = simulation.runTurn(program, {
      mission: { ...roundTrip, contingencyIds: ["test-backup-engine"] },
    });
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(next))),
    );
    expect(restored).toEqual(next);
  });
});

describe("saves from before round trips", () => {
  it("upgrade with every Crew member at Mars on a one-way trip", () => {
    const { simulation } = lasting();
    // A literal copy of what format 8 looks like. Don't change this: it's a compatibility contract.
    const formatEight = {
      formatVersion: 8,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 600,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-crew"],
        landedSiteIds: [],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [],
        crew: [
          {
            name: "Ann Able",
            health: 80,
            arrivedOn: "2029-06-19",
            location: { kind: "marsOrbit" },
            protectionId: "test-protection-none",
          },
          {
            name: "Ben Baker",
            health: 0,
            arrivedOn: null,
            location: { kind: "lost", lostOn: "2029-01-01", cause: "health" },
            protectionId: "test-protection-none",
          },
        ],
        crewActivities: { "mars-orbit": "test-research" },
        crewSupplies: { "mars-orbit": 500 },
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatEight);
    expect(simulation.readProgram(restored).crew).toEqual([
      expect.objectContaining({
        members: [{ name: "Ann Able", health: 80, arrivedOn: "2029-06-19" }],
        waysHome: [],
      }),
    ]);
    expect(restored.earthReturnStages).toEqual([]);
  });
});
