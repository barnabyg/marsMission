import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const shielded = {
  ...crewMission,
  crew: { size: 2, protectionId: "test-shielding" },
};
const sendCrew: TurnPlan = { mission: crewMission };
const sendShielded: TurnPlan = { mission: shielded };

describe("buying Protection", () => {
  it("is none unless the player buys some, and offers each level with the Health it leaves the Crew on arrival", () => {
    const { simulation, program } = setup();
    const planned = simulation.previewCrew(program, crewMission);
    expect(planned?.protectionId).toBe("test-protection-none");
    // 20 Health to radiation on the Slow Trajectory's 200 days, which the Shielding halves.
    expect(
      planned?.protection.map(({ id, radiationCutPercent, arrivalHealth }) => [
        id,
        radiationCutPercent,
        arrivalHealth,
      ]),
    ).toEqual([
      ["test-protection-none", 0, 80],
      ["test-shielding", 50, 90],
    ]);
    expect(simulation.previewCrew(program, shielded)?.arrivalHealth).toBe(90);
    expect(
      simulation
        .readProgram(program)
        .crewedMission.protection.map(({ name }) => name),
    ).toEqual(["None", "Shielding"]);
  });

  it("adds the chosen level's cost and mass to the Mission's", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendShielded)).toMatchObject({
      costMillions: 300 + 1000 + 100 + 100,
      massTonnes: 6 + 1 + 1,
      problems: [],
    });
  });

  it("refuses a level the Catalogue doesn't offer", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, {
        mission: { ...crewMission, crew: { size: 2, protectionId: "lead" } },
      }).problems,
    ).toEqual(['There is no Protection called "lead".']);
  });
});

describe("Protection against radiation", () => {
  it("slows the Health lost to radiation on the way and at Mars, and the Turn summary says how much it saved", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendShielded);
    // Half of 20 on the way and of 29 in 580 days at Mars, which leaves time at Mars as it is.
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [
        { cause: "radiationInFlight", health: 10 },
        { cause: "radiationAtMars", health: 14 },
        { cause: "timeAtMars", health: 29 },
      ],
      savedByProtection: 10 + 15,
    });
    expect(summary.crew.map(({ health }) => health)).toEqual([47, 47]);
  });

  it("says nothing was saved for Crew with no Protection", () => {
    const { simulation, program } = setup();
    expect(
      simulation
        .runTurn(program, sendCrew)
        .summary.healthLost.map((each) => "savedByProtection" in each),
    ).toEqual([false, false]);
  });

  it("stays with the Crew at Mars through a save and a load", () => {
    const { simulation, program } = setup();
    const { program: arrived } = simulation.runTurn(program, sendShielded);
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(arrived))),
    );
    const { timeline } = simulation.runTurn(restored, skipTurn);
    // 47 Health lasts until day 640 at a quarter less a day than the 22 an unprotected Crew has lasts, to day 220.
    expect(timeline.entries.find(({ kind }) => kind === "crewLost")?.day).toBe(
      640,
    );
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(arrived, skipTurn),
    );
  });

  it("stays with each Crew member, when Crew join others with a different level", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
    });
    const { program: first } = simulation.runTurn(program, sendShielded);
    const { summary } = simulation.runTurn(first, sendCrew);
    const radiationAtMars = (name: string) =>
      summary.healthLost
        .find((each) => each.name === name)
        ?.lost.find(({ cause }) => cause === "radiationAtMars")?.health;
    // The Shielding's Crew die on day 640, when their 47 runs out.
    expect(radiationAtMars("Ann Able")).toBe(16);
    expect(radiationAtMars("Cal Cole")).toBe(29);
  });
});

describe("a save from before Protection", () => {
  it("gives the Crew in it no Protection", () => {
    const { simulation } = setup();
    // A literal copy of what format 11 looks like. Don't change this: it's a compatibility contract.
    const formatEleven = {
      formatVersion: 11,
      program: {
        seed: 1,
        turnNumber: 4,
        date: "2034-10-26",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-crew-at-mars"],
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
            health: 60,
            arrivedOn: "2031-06-19",
            location: { kind: "marsOrbit" },
          },
          {
            name: "Ben Baker",
            health: 0,
            arrivedOn: null,
            location: { kind: "lost", lostOn: "2031-01-01", cause: "health" },
          },
        ],
        crewActivities: { "mars-orbit": "test-research" },
        crewSupplies: { "mars-orbit": 500 },
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatEleven);
    expect(restored.crew.map(({ protectionId }) => protectionId)).toEqual([
      "test-protection-none",
      "test-protection-none",
    ]);
    // 0.05 a day for radiation and for time at Mars: 60 runs out on day 600.
    expect(
      simulation
        .runTurn(restored, skipTurn)
        .timeline.entries.find(({ kind }) => kind === "crewLost")?.day,
    ).toBe(600);
  });
});
