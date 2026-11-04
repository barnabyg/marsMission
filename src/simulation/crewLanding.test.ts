import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, steadyHealth, withFailures } from "./testHelpers";

const landingCrew = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2, landsAtSite: true },
  landingSiteId: "alpha-plain",
};
const landCrew: TurnPlan = { mission: landingCrew };

/** Crew whose Health never falls, and who land wherever they go. */
const lasting = () => withFailures([], { crewHealth: steadyHealth });

/** Two Turns' worth of money, so that two Crewed Missions can fly. */
const wealthy = () =>
  withFailures([], { startingMoneyMillions: 5000, crewHealth: steadyHealth });

describe("planning a Crew landing", () => {
  it("lands at the Landing Site through entry/descent/landing after Mars orbit insertion, at the site's risk", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, landCrew).problems).toEqual([]);
    expect(
      simulation
        .previewMission(program, landingCrew)
        .map(({ name, riskBand }) => [name, riskBand]),
    ).toEqual([
      ["Test launch", "~1%"],
      ["Test burn", "~1%"],
      ["Test arrival", "~1%"],
      ["Test landing", "Over 10%"],
    ]);
  });

  it("must choose a known Landing Site, and only a landing Crew have one", () => {
    const { simulation, program } = setup();
    const noSite = {
      launchVehicleId: "test-heavy",
      assetIds: [],
      crew: { size: 2, landsAtSite: true },
    };
    expect(
      simulation.validatePlan(program, { mission: noSite }).problems,
    ).toEqual(["A Mission that lands on Mars must choose a Landing Site."]);
    expect(
      simulation.validatePlan(program, {
        mission: { ...landingCrew, crew: { size: 2 } },
      }).problems,
    ).toEqual(["Only a Mission that lands on Mars has a Landing Site."]);
  });

  it("offers the surface's Activities, which Crew in orbit can't do", () => {
    const { simulation, program } = setup();
    const crew = simulation.previewCrew(program, landingCrew);
    expect(crew?.activities.map(({ id }) => id)).toEqual([
      "test-traverse",
      "test-nothing",
    ]);
    expect(crew?.activities[0]?.earnsPerTurn?.science).toBe(2 * 156);
    expect(
      simulation.validatePlan(program, {
        mission: {
          ...landingCrew,
          crew: { size: 2, landsAtSite: true, activityId: "test-research" },
        },
      }).problems,
    ).toEqual([`Crew in Alpha Plain can't do the Activity "Test research".`]);
  });
});

describe("Crew at a Landing Site", () => {
  it("land there as entry/descent/landing succeeds, and operate there, a place of their own", () => {
    const { simulation, program } = lasting();
    const { program: next, timeline } = simulation.runTurn(program, landCrew);
    expect(simulation.readProgram(next).crew).toEqual([
      expect.objectContaining({
        key: "landing-site:alpha-plain",
        locationName: "Alpha Plain",
        landingSiteId: "alpha-plain",
        activityId: "test-traverse",
        members: [
          { name: "Ann Able", health: 100, arrivedOn: "2029-06-24" },
          { name: "Ben Baker", health: 100, arrivedOn: "2029-06-24" },
        ],
      }),
    ]);
    expect(
      timeline.entries.filter(({ kind }) => kind === "crewArrived"),
    ).toEqual([
      {
        kind: "crewArrived",
        day: 205,
        title: "Crew in Alpha Plain",
        description:
          "Ann Able and Ben Baker have landed in Alpha Plain aboard the Test Crew Ship, and start Test traverse.",
      },
    ]);
    expect(
      timeline.entries.find(
        (entry) =>
          entry.kind === "missionEvent" && entry.eventId === "test-landing",
      )?.description,
    ).toBe("The Test Crew Ship touched down at Alpha Plain.");
  });

  it("earn the first-landing Science, the Milestone for the first Crew landing and the one for the first Crew at Mars", () => {
    const { simulation, program } = wealthy();
    const first = simulation.runTurn(program, landCrew);
    expect(first.summary.firstLanding).toEqual({
      siteName: "Alpha Plain",
      science: 50,
    });
    expect(first.summary.milestones).toEqual([
      {
        name: "First Crew at Mars",
        description: "Crew reached Mars.",
        science: 30,
        publicSupport: 150,
      },
      {
        name: "First Crew landing",
        description: "Crew reached the surface.",
        science: 50,
        publicSupport: 100,
      },
    ]);
    // A second Crew landing at the same site earns neither again.
    const second = simulation.runTurn(first.program, landCrew);
    expect(second.summary.firstLanding).toBeNull();
    expect(second.summary.milestones).toEqual([]);
  });

  it("share one Activity and earn Ongoing Research at the surface's rate for each Crew member", () => {
    const { simulation, program } = lasting();
    const first = simulation.runTurn(program, landCrew);
    // 575 of the Turn's 780 days at 156 a Turn, for each of the two.
    expect(first.summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Alpha Plain",
        activityName: "Test traverse",
        science: 230,
        publicSupport: 0,
        days: 575,
      },
    ]);
  });

  it("earn more while a Benefit raises research on the surface, as an Asset there does", () => {
    const { simulation, program } = lasting();
    const withRelay = {
      mission: { ...landingCrew, assetIds: ["test-relay"] },
    };
    expect(
      simulation.previewCrew(program, withRelay.mission)?.activities[0],
    ).toMatchObject({
      earnsPerTurn: { science: 2 * 234 },
      raisedBy: { percent: 50, givenBy: ["Test Relay"] },
    });
    const { summary } = simulation.runTurn(program, withRelay);
    // 575 days at 150% of 156 a Turn, rounded up for each of the two.
    expect(summary.ongoingResearch).toContainEqual({
      assetName: "Crew in Alpha Plain",
      activityName: "Test traverse",
      science: 2 * 173,
      publicSupport: 0,
      days: 575,
      benefit: {
        givenBy: ["Test Relay"],
        days: 575,
        science: 2 * 173 - 230,
        publicSupport: 0,
      },
    });
  });

  it("are a place apart from Crew in Mars orbit, with Activities of their own", () => {
    const { simulation, program } = wealthy();
    const inOrbit = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: [],
        crew: { size: 2 },
      },
    });
    expect(simulation.previewCrew(inOrbit.program, landingCrew)).toMatchObject({
      joining: null,
      activityId: "test-traverse",
    });
    const landed = simulation.runTurn(inOrbit.program, landCrew);
    const view = simulation.readProgram(landed.program);
    expect(view.crew.map(({ key, activityId }) => [key, activityId])).toEqual([
      ["mars-orbit", "test-research"],
      ["landing-site:alpha-plain", "test-traverse"],
    ]);
    expect(
      simulation.validatePlan(landed.program, {
        mission: null,
        crewActivities: { "landing-site:alpha-plain": "test-research" },
      }).problems,
    ).toEqual([`Crew in Alpha Plain can't do the Activity "Test research".`]);
  });

  it("join the Activity of Crew already at the same Landing Site", () => {
    const { simulation, program } = wealthy();
    const first = simulation.runTurn(program, landCrew);
    expect(simulation.previewCrew(first.program, landingCrew)).toMatchObject({
      joining: "Alpha Plain",
    });
    const second = simulation.runTurn(first.program, {
      mission: landingCrew,
      crewActivities: { "landing-site:alpha-plain": "test-nothing" },
    });
    const [group] = simulation.readProgram(second.program).crew;
    expect(group?.members).toHaveLength(4);
    expect(group?.activityName).toBe("Nothing");
  });
});

describe("a Crew landing that fails", () => {
  it("loses the Crew in a crash, as losing Crew does", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const {
      summary,
      program: next,
      timeline,
    } = simulation.runTurn(program, landCrew);
    expect(summary.crewLost).toEqual([
      expect.objectContaining({
        names: ["Ann Able", "Ben Baker"],
        cause: "missionEvent",
      }),
    ]);
    expect(simulation.readProgram(next).crew).toEqual([]);
    expect(
      timeline.mission?.assets.find(({ kind }) => kind === "crew"),
    ).toEqual({
      name: "Test Crew Ship",
      kind: "crew",
      landingSiteName: "Alpha Plain",
      deliveredOnDay: null,
      lostOnDay: 205,
      crashed: true,
    });
  });

  it("costs the Crew Health when a Contingency saves it with a hard landing", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const {
      summary,
      program: next,
      timeline,
    } = simulation.runTurn(
      program,
      { mission: { ...landingCrew, contingencyIds: ["test-thrusters"] } },
      { "contingency:test-landing": "use" },
    );
    expect(summary.healthLost[0]?.lost).toContainEqual({
      cause: "contingency",
      health: 10,
    });
    expect(simulation.readProgram(next).crew[0]?.locationName).toBe(
      "Alpha Plain",
    );
    expect(
      timeline.entries.find(
        (entry) =>
          entry.kind === "missionEvent" && entry.eventId === "test-landing",
      )?.description,
    ).toBe(
      "The Test Crew Ship made a hard landing at Alpha Plain. Ann Able and Ben Baker lost 10 Health each.",
    );
  });
});

describe("Crew at a Landing Site in Mission Mode", () => {
  it("come down there aboard their ship, which stands at the site for them", () => {
    const { simulation, program } = lasting();
    const { timeline } = simulation.runTurn(program, landCrew);
    expect(
      timeline.mission?.assets.find(({ kind }) => kind === "crew"),
    ).toMatchObject({ landingSiteName: "Alpha Plain", deliveredOnDay: 205 });
    expect(timeline.assetsAtMars).toContainEqual(
      expect.objectContaining({
        key: "crew:landing-site:alpha-plain",
        kind: "crew",
        landingSiteName: "Alpha Plain",
        fromDay: 205,
      }),
    );
  });

  it("show each Crew member there, getting about as their Activity does", () => {
    const { simulation, program } = lasting();
    const { timeline } = simulation.runTurn(program, landCrew);
    expect(
      timeline.assetsAtMars.find(({ kind }) => kind === "crew"),
    ).toMatchObject({
      surfaceMotion: "traverse",
      crew: [
        { name: "Ann Able", arrivedOnDay: 205, fromDay: 205, untilDay: null },
        { name: "Ben Baker", arrivedOnDay: 205, fromDay: 205, untilDay: null },
      ],
    });
  });

  it("show Crew who land where Crew already are beside them, each with the day they arrived", () => {
    const { simulation, program } = wealthy();
    const first = simulation.runTurn(program, landCrew);
    const { timeline } = simulation.runTurn(first.program, landCrew);
    const ships = timeline.assetsAtMars.filter(({ kind }) => kind === "crew");
    expect(ships).toHaveLength(1);
    // The Turn is 780 days long, so the first Crew arrived 575 days before it started.
    expect(
      ships[0]?.crew?.map(({ name, arrivedOnDay, fromDay }) => [
        name,
        arrivedOnDay,
        fromDay,
      ]),
    ).toEqual([
      ["Ann Able", -575, 0],
      ["Ben Baker", -575, 0],
      ["Cal Cole", 205, 205],
      ["Dee Dunn", 205, 205],
    ]);
  });

  it("show each Crew member until the day they die there", () => {
    const { simulation, program } = withFailures([]);
    const landed = simulation.runTurn(program, landCrew).program;
    const { timeline } = simulation.runTurn(landed, skipTurn);
    const died = timeline.entries.find(({ kind }) => kind === "crewLost");
    expect(died?.day).toBeGreaterThan(0);
    const [ship] = timeline.assetsAtMars.filter(({ kind }) => kind === "crew");
    expect(ship?.crew?.map(({ untilDay }) => untilDay)).toEqual([
      died?.day,
      died?.day,
    ]);
    expect(ship?.untilDay).toBe(died?.day);
  });
});

describe("saving Crew at a Landing Site", () => {
  it("keeps them there, with their Activity, through saving and loading", () => {
    const { simulation, program } = lasting();
    const landed = simulation.runTurn(program, landCrew).program;
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(landed))),
    );
    expect(restored).toEqual(landed);
    expect(simulation.readProgram(restored).crew[0]?.key).toBe(
      "landing-site:alpha-plain",
    );
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(landed, skipTurn),
    );
  });
});
