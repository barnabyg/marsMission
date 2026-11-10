import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, steadyHealth, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };

/** Two Turns' worth of money, so that two Crewed Missions can fly, and Crew whose Health lasts. */
const wealthy = () =>
  withFailures([], {
    startingMoneyMillions: 5000,
    crewHealth: steadyHealth,
  });

/** Crew whose Health never falls, for the tests that follow them over several Turns. */
const lasting = () => withFailures([], { crewHealth: steadyHealth });

describe("Crew at Mars", () => {
  it("arrive in Mars orbit as the Mission's arrival succeeds, named in the data files' order", () => {
    const { simulation, program } = lasting();
    const { program: next, timeline } = simulation.runTurn(program, sendCrew);
    expect(simulation.readProgram(next).crew).toEqual([
      expect.objectContaining({
        key: "mars-orbit",
        locationName: "Mars orbit",
        activityId: "test-research",
        activityName: "Test research",
        members: [
          { name: "Ann Able", health: 100, arrivedOn: "2029-06-19" },
          { name: "Ben Baker", health: 100, arrivedOn: "2029-06-19" },
        ],
      }),
    ]);
    expect(
      timeline.entries.filter(({ kind }) => kind === "crewArrived"),
    ).toEqual([
      {
        kind: "crewArrived",
        day: 200,
        title: "Crew in Mars orbit",
        description:
          "Ann Able and Ben Baker have arrived in Mars orbit aboard the Test Crew Ship, and start Test research.",
      },
    ]);
  });

  it("don't arrive if the Mission fails on the way", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { program: next, summary } = simulation.runTurn(program, sendCrew);
    expect(simulation.readProgram(next).crew).toEqual([]);
    expect(summary.crew).toEqual([]);
  });

  it("award the Milestone for the first Crew at Mars on the day they arrive, once", () => {
    const { simulation, program } = wealthy();
    const first = simulation.runTurn(program, sendCrew);
    expect(first.summary.milestones).toEqual([
      {
        name: "First Crew at Mars",
        description: "Crew reached Mars.",
        science: 30,
        publicSupport: 150,
      },
    ]);
    expect(
      first.timeline.entries.find(({ kind }) => kind === "milestone")?.day,
    ).toBe(200);
    const second = simulation.runTurn(first.program, sendCrew);
    expect(second.summary.milestones).toEqual([]);
  });

  it("share one Activity and earn Ongoing Research for each Crew member, which the Turn summary reports", () => {
    const { simulation, program } = lasting();
    const first = simulation.runTurn(program, sendCrew);
    // 580 of the Turn's 780 days, for each of the two.
    expect(first.summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Mars orbit",
        activityName: "Test research",
        science: 116,
        publicSupport: 58,
        days: 580,
      },
    ]);
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Mars orbit",
        activityName: "Test research",
        science: 156,
        publicSupport: 78,
        days: 780,
      },
    ]);
  });

  it("keep their Activity into later Turns until the player changes it", () => {
    const { simulation, program } = lasting();
    const first = simulation.runTurn(program, sendCrew);
    const resting = simulation.runTurn(first.program, {
      mission: null,
      crewActivities: { "mars-orbit": "test-nothing" },
    });
    expect(resting.summary.ongoingResearch).toEqual([]);
    const later = simulation.runTurn(resting.program, skipTurn);
    expect(later.summary.ongoingResearch).toEqual([]);
    expect(simulation.readProgram(later.program).crew[0]?.activityName).toBe(
      "Nothing",
    );
  });

  it("rejects a new Activity for Crew who aren't there, or one they can't do", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, {
        mission: null,
        crewActivities: { "mars-orbit": "test-nothing" },
      }).problems,
    ).toEqual([`There are no Crew operating at "mars-orbit".`]);
    const { program: next } = simulation.runTurn(program, sendCrew);
    expect(
      simulation.validatePlan(next, {
        mission: null,
        crewActivities: { "mars-orbit": "test-survey" },
      }).problems,
    ).toEqual([`Crew in Mars orbit can't do the Activity "Survey".`]);
  });

  it("give a later Crew the next names, joining the Activity of the Crew already there", () => {
    const { simulation, program } = wealthy();
    const first = simulation.runTurn(program, sendCrew);
    const joining = {
      mission: {
        ...crewMission,
        crew: { size: 2, activityId: "test-research" },
      },
      crewActivities: { "mars-orbit": "test-nothing" },
    };
    expect(
      simulation.previewCrew(first.program, joining.mission),
    ).toMatchObject({ names: ["Cal Cole", "Dee Dunn"], joining: "Mars orbit" });
    const second = simulation.runTurn(first.program, joining);
    const [group] = simulation.readProgram(second.program).crew;
    expect(group?.members.map(({ name }) => name)).toEqual([
      "Ann Able",
      "Ben Baker",
      "Cal Cole",
      "Dee Dunn",
    ]);
    expect(group?.activityName).toBe("Nothing");
    expect(second.summary.ongoingResearch).toEqual([]);
  });

  it("rejects a Crew larger than the names left to give", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 9000,
    });
    const first = simulation.runTurn(program, sendCrew);
    const second = simulation.runTurn(first.program, sendCrew);
    expect(simulation.readProgram(second.program).crewedMission.namesLeft).toBe(
      1,
    );
    expect(simulation.validatePlan(second.program, sendCrew).problems).toEqual([
      "Only 1 Crew member is left to fly, too few for a Crew of 2.",
    ]);
  });

  it("are listed with their Health in the Turn summary", () => {
    const { simulation, program } = lasting();
    const first = simulation.runTurn(program, sendCrew);
    expect(first.summary.crew).toEqual([
      {
        name: "Ann Able",
        locationName: "Mars orbit",
        health: 100,
        maxHealth: 100,
        arrived: true,
      },
      {
        name: "Ben Baker",
        locationName: "Mars orbit",
        health: 100,
        maxHealth: 100,
        arrived: true,
      },
    ]);
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.crew.map(({ arrived }) => arrived)).toEqual([
      false,
      false,
    ]);
  });

  it("show on the Timeline: their ship on the way and in Mars orbit", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendCrew);
    expect(timeline.mission?.assets).toEqual([
      {
        name: "Test Crew Ship",
        kind: "crew",
        landingSiteName: null,
        deliveredOnDay: 200,
        lostOnDay: null,
        crashed: false,
      },
    ]);
    expect(timeline.assetsAtMars).toEqual([
      expect.objectContaining({
        key: "crew:mars-orbit",
        name: "Test Crew Ship",
        kind: "crew",
        landingSiteName: null,
        fromDay: 200,
        untilDay: null,
      }),
    ]);
  });
});

describe("Crew and the Mission's failure", () => {
  it("names the Crew still on board when a Mission Event fails, as it does Assets", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { timeline } = simulation.runTurn(program, {
      mission: { ...crewMission, assetIds: ["test-relay"] },
    });
    expect(
      timeline.entries.find((entry) => entry.title === "Test burn failed")
        ?.description,
    ).toBe(
      "The engine cut out. Lost with the Mission: Test Relay, Ann Able, Ben Baker. It costs 30 Public Support.",
    );
  });
});

describe("saving Crew", () => {
  it("restores the Crew at Mars, their Health and Activity, and plays on as if never saved", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, {
      mission: {
        ...crewMission,
        crew: { size: 2, activityId: "test-nothing" },
      },
    });
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(flown))),
    );
    expect(restored).toEqual(flown);
    expect(simulation.readProgram(restored).crew[0]?.activityName).toBe(
      "Nothing",
    );
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(flown, skipTurn),
    );
  });

  it("upgrades a save from before Crew with none at Mars, and every name still to give", () => {
    const { simulation } = setup();
    // A literal copy of what format 7 looks like. Don't change this: it's a compatibility contract.
    const formatSeven = {
      formatVersion: 7,
      program: {
        seed: 1,
        turnNumber: 4,
        date: "2034-10-26",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-orbiter"],
        landedSiteIds: [],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [
          { technologyId: "test-future-vehicle", finishesOnTurn: 3 },
        ],
        operatingAssets: [
          {
            assetId: "test-orbiter",
            name: "Test Orbiter",
            kind: "orbiter",
            arrivedOn: "2029-06-19",
            landingSiteId: null,
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-research",
            flewUnproven: false,
          },
        ],
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatSeven);
    const view = simulation.readProgram(restored);
    expect(view.crew).toEqual([]);
    expect(view.crewedMission.namesLeft).toBe(5);
    expect(view.operatingAssets.map(({ name }) => name)).toEqual([
      "Test Orbiter",
    ]);
    expect(
      simulation.validatePlan(restored, {
        mission: null,
        crewActivities: { "mars-orbit": "test-nothing" },
      }).problems,
    ).toEqual([`There are no Crew operating at "mars-orbit".`]);
  });

  it("refuses a save whose Crew are somewhere no rule knows", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, sendCrew);
    const saved = simulation.saveProgram(flown);
    expect(() =>
      simulation.restoreProgram({
        ...saved,
        program: {
          ...saved.program,
          crew: saved.program.crew.map((member) => ({
            ...member,
            location: { kind: "phobos" },
          })),
        },
      }),
    ).toThrow(/corrupt/);
  });
});
