import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };

/** Two Turns' worth of money, so that two Crewed Missions can fly. */
const wealthy = () => withFailures([], { startingMoneyMillions: 5000 });

describe("planning a Crewed Mission", () => {
  it("offers each Crew size with what it weighs and costs, and the Health Crew start with", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).crewedMission).toEqual({
      vehicleName: "Test Crew Ship",
      sizes: [
        { crew: 2, costMillions: 1000, massTonnes: 6 },
        { crew: 3, costMillions: 1200, massTonnes: 8 },
      ],
      maxHealth: 100,
      namesLeft: 5,
    });
  });

  it("adds the Crew size's cost and mass to the Mission's", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendCrew)).toMatchObject({
      costMillions: 300 + 1000,
      massTonnes: 6,
      problems: [],
    });
    const larger = { mission: { ...crewMission, crew: { size: 3 } } };
    expect(simulation.validatePlan(program, larger)).toMatchObject({
      costMillions: 300 + 1200,
      massTonnes: 8,
    });
  });

  it("rejects a Crewed Mission that is too heavy for its Launch Vehicle", () => {
    const { simulation, program } = setup();
    const onSmall = {
      mission: { ...crewMission, launchVehicleId: "test-vehicle" },
    };
    expect(simulation.validatePlan(program, onSmall).problems).toEqual([
      "This Mission weighs 6 tonnes, but its Launch Vehicle can only carry 5 tonnes.",
    ]);
  });

  it("carries Assets as well as Crew, within its Launch Vehicle's mass", () => {
    const { simulation, program } = setup();
    const both = { mission: { ...crewMission, assetIds: ["test-relay"] } };
    expect(simulation.validatePlan(program, both)).toMatchObject({
      massTonnes: 8,
      problems: [],
    });
  });

  it("rejects a Mission with neither Assets nor Crew", () => {
    const { simulation, program } = setup();
    const empty = { mission: { launchVehicleId: "test-heavy", assetIds: [] } };
    expect(simulation.validatePlan(program, empty).problems).toEqual([
      "A Mission must carry at least one Asset or Crew.",
    ]);
  });

  it("rejects a Crew size that isn't on offer, and an Activity Crew can't do", () => {
    const { simulation, program } = setup();
    const odd = {
      mission: { ...crewMission, crew: { size: 5, activityId: "test-survey" } },
    };
    expect(simulation.validatePlan(program, odd).problems).toEqual([
      "There is no Crew size of 5.",
      `Crew can't do the Activity "Survey".`,
    ]);
  });

  it("goes through the Crewed Mission's own Mission Events, with no Asset aboard", () => {
    const { simulation, program } = setup();
    expect(
      simulation.previewMission(program, crewMission).map(({ name }) => name),
    ).toEqual(["Test launch", "Test burn", "Test arrival"]);
  });

  it("previews who would fly, their Activity and what the whole Crew would earn with it", () => {
    const { simulation, program } = setup();
    const crew = simulation.previewCrew(program, crewMission);
    expect(crew).toMatchObject({
      size: 2,
      names: ["Ann Able", "Ben Baker"],
      activityId: "test-research",
      joining: null,
    });
    // Each Crew member earns the Activity's rate.
    expect(crew?.activities[0]?.earnsPerTurn).toEqual({
      science: 156,
      publicSupport: 78,
      researchGrantMillions: 0,
    });
    expect(
      simulation.previewCrew(program, {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter"],
      }),
    ).toBeNull();
  });
});

describe("Crew at Mars", () => {
  it("arrive in Mars orbit as the Mission's arrival succeeds, named in the data files' order, at full Health", () => {
    const { simulation, program } = setup();
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
      { name: "First Crew at Mars", science: 30, publicSupport: 150 },
    ]);
    expect(
      first.timeline.entries.find(({ kind }) => kind === "milestone")?.day,
    ).toBe(200);
    const second = simulation.runTurn(first.program, sendCrew);
    expect(second.summary.milestones).toEqual([]);
  });

  it("share one Activity and earn Ongoing Research for each Crew member, which the Turn summary reports", () => {
    const { simulation, program } = setup();
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
    const { simulation, program } = setup();
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
    ).toEqual([`Crew can't do the Activity "Survey".`]);
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
    const { simulation, program } = setup();
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
