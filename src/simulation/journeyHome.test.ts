import { describe, expect, it } from "vitest";
import type { CatalogueFiles } from "../catalogue/catalogue";
import type { Program, Simulation } from "./simulation";
import type { PlannedMission } from "./types";
import { sendOrbiter, steadyHealth, withFailures } from "./testHelpers";

const roundTrip: PlannedMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2, roundTrip: true },
};
const stageKey = "earth-return-stage:2029-06-19";
const bringThemHome = { mission: null, bringHome: stageKey };

/**
 * A Program on its second Turn, with round-trip Crew in Mars orbit since day 200 of the first, flown with these
 * choices, in a Simulation whose named Mission Events always fail.
 */
function atMars(
  failing: string[] = [],
  {
    mission = roundTrip,
    crewHealth = steadyHealth,
    suppliesPerMemberPerDayKg,
  }: {
    mission?: PlannedMission;
    crewHealth?: Partial<CatalogueFiles["crew"]["health"]>;
    suppliesPerMemberPerDayKg?: number;
  } = {},
): { simulation: Simulation; program: Program } {
  const { simulation, program } = withFailures(failing, {
    startingMoneyMillions: 5000,
    crewHealth,
    ...(suppliesPerMemberPerDayKg === undefined
      ? {}
      : { suppliesPerMemberPerDayKg }),
  });
  return {
    simulation,
    program: simulation.runTurn(program, { mission }).program,
  };
}

describe("bringing round-trip Crew home", () => {
  it("flies the journey home's Mission Events on a later Turn, with no new Mission, and brings the Crew home", () => {
    const { simulation, program } = atMars();
    const {
      program: next,
      timeline,
      summary,
    } = simulation.runTurn(program, bringThemHome);
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "missionEvent" || kind === "crewHome")
        .map(({ day, title }) => [day, title]),
    ).toEqual([
      [102, "Test departure home"],
      [300, "Test splashdown"],
      [300, "Crew home"],
    ]);
    // Mission Mode shows them leaving from Mars orbit, with no Mars ascent.
    expect(timeline.journeyHome).toMatchObject({
      aboard: "crew",
      siteName: null,
    });
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(summary.journeyHome).toEqual({
      crew: ["Ann Able", "Ben Baker"],
      samples: 0,
      samplesFrom: null,
      failure: null,
    });
    const view = simulation.readProgram(next);
    expect(view.crew).toEqual([]);
    expect(view.crewedMission.namesLeft).toBe(3);
  });

  it("flies the journey home alongside a new Mission in the same Turn", () => {
    const { simulation, program } = atMars();
    const { program: next, summary } = simulation.runTurn(program, {
      ...sendOrbiter,
      bringHome: stageKey,
    });
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(simulation.readProgram(next).operatingAssets).toHaveLength(1);
  });

  it("earns Public Support for each Crew member home, and the First Crew home Milestone, on the day they splash down", () => {
    const { simulation, program } = atMars();
    const { timeline, summary } = simulation.runTurn(program, bringThemHome);
    expect(summary.publicSupportForCrewHome).toBe(2 * 40);
    expect(summary.milestones).toEqual([
      {
        name: "First Crew home",
        description: "Crew came home from Mars.",
        science: 60,
        publicSupport: 300,
      },
    ]);
    expect(
      timeline.entries.find(({ kind }) => kind === "crewHome"),
    ).toMatchObject({
      day: 300,
      description:
        "Ann Able and Ben Baker are home safe, which earns 80 Public Support. They won't fly again.",
    });
    expect(timeline.entries.find(({ kind }) => kind === "milestone")?.day).toBe(
      300,
    );
  });

  it("stops the Crew's research at Mars on the day they leave", () => {
    const { simulation, program } = atMars();
    const staying = simulation.runTurn(program, { mission: null });
    const leaving = simulation.runTurn(program, bringThemHome);
    expect(staying.summary.ongoingResearch[0]?.days).toBe(780);
    expect(leaving.summary.ongoingResearch[0]?.days).toBe(100);
  });

  it("refuses to bring the same Crew home twice", () => {
    const { simulation, program } = atMars();
    const { program: home } = simulation.runTurn(program, bringThemHome);
    expect(simulation.validatePlan(home, bringThemHome).problems).toEqual([
      "There are no Crew at Mars waiting to come home aboard the Earth return stage this plan chooses.",
    ]);
  });
});

describe("Crew left at Mars", () => {
  it("keep their share of the Supplies in Mars orbit when round-trip Crew leave with theirs", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
      crewHealth: steadyHealth,
    });
    const oneWay = simulation.runTurn(program, {
      mission: { ...roundTrip, crew: { size: 2 } },
    }).program;
    const both = simulation.runTurn(oneWay, { mission: roundTrip }).program;
    const key = simulation.readProgram(both).crew[0]?.waysHome[0]?.key;
    expect(key).toBe("earth-return-stage:2031-08-08");
    // Four Crew share the 830 kilograms in Mars orbit as the Turn starts, and have 730 left as two of them leave on day
    // 100, which take half. The two who stay use the rest, half a kilogram a day, leaving 25: 50 days' worth.
    const { program: next, summary } = simulation.runTurn(both, {
      mission: null,
      ...(key === undefined ? {} : { bringHome: key }),
    });
    expect(summary.crewHome).toEqual(["Cal Cole", "Dee Dunn"]);
    expect(simulation.readProgram(next).crew).toEqual([
      expect.objectContaining({
        members: [
          expect.objectContaining({ name: "Ann Able" }),
          expect.objectContaining({ name: "Ben Baker" }),
        ],
        suppliesDaysLeft: 50,
        waysHome: [],
      }),
    ]);
  });

  it("die there if their Health runs out before they leave, and don't come home", () => {
    const { simulation, program } = atMars([], {
      crewHealth: { ...steadyHealth, timeAtMarsPerDay: 0.15 },
    });
    const { program: next, summary } = simulation.runTurn(
      program,
      bringThemHome,
    );
    expect(summary.journeyHome).toBeNull();
    expect(summary.crewHome).toEqual([]);
    expect(summary.crewLost.map(({ cause }) => cause)).toEqual(["health"]);
    expect(next.earthReturnStages).toEqual([]);
  });

  it("earn the First Crew home Milestone only once, though every safe return earns Public Support", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
      crewHealth: steadyHealth,
    });
    const first = simulation.runTurn(program, { mission: roundTrip }).program;
    const second = simulation.runTurn(first, {
      mission: roundTrip,
      bringHome: stageKey,
    });
    const key = simulation.readProgram(second.program).crew[0]?.waysHome[0]
      ?.key;
    const third = simulation.runTurn(second.program, {
      mission: null,
      ...(key === undefined ? {} : { bringHome: key }),
    });
    expect(second.summary.milestones.map(({ name }) => name)).toContain(
      "First Crew home",
    );
    expect(third.summary.crewHome).toEqual(["Cal Cole", "Dee Dunn"]);
    expect(third.summary.publicSupportForCrewHome).toBe(80);
    expect(third.summary.milestones).toEqual([]);
  });
});

describe("Mission Events on the way home", () => {
  it("lose the Crew if one fails, with its Public Support and that for losing Crew", () => {
    const { simulation, program } = atMars(["test-splashdown"]);
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, bringThemHome);
    expect(summary.crewHome).toEqual([]);
    expect(summary.journeyHome).toEqual({
      crew: ["Ann Able", "Ben Baker"],
      samples: 0,
      samplesFrom: null,
      failure: { missionEventName: "Test splashdown", publicSupportLost: 35 },
    });
    expect(summary.crewLost).toEqual([
      expect.objectContaining({
        names: ["Ann Able", "Ben Baker"],
        cause: "missionEvent",
        publicSupportLost: 2 * 20,
      }),
    ]);
    expect(
      timeline.entries.find(
        ({ kind, title }) =>
          kind === "missionEvent" && title === "Test splashdown failed",
      )?.day,
    ).toBe(300);
    expect(simulation.readProgram(next).crew).toEqual([]);
    expect(simulation.validatePlan(next, bringThemHome).problems).not.toEqual(
      [],
    );
  });

  it("are as safe as the Reliability bought for them with the round trip", () => {
    const { simulation, program } = withFailures([]);
    const risky = simulation.previewMission(program, {
      ...roundTrip,
      reliability: { "test-departure-home": "redundant" },
    });
    expect(
      risky.find(({ eventId }) => eventId === "test-departure-home"),
    ).toMatchObject({ reliabilityLevelId: "redundant" });
  });

  it("offer the Contingency bought with the round trip as a Decision Point, which can save the Crew at a cost in Health", () => {
    const { simulation, program } = atMars(["test-departure-home"], {
      mission: { ...roundTrip, contingencyIds: ["test-backup-engine"] },
      crewHealth: { ...steadyHealth, contingencyRescueLoss: 10 },
    });
    const progress = simulation.workOutTurn(program, bringThemHome);
    expect(progress.decisionPoint).toMatchObject({
      id: "contingency:test-departure-home",
      kind: "contingency",
      day: 102,
      assets: ["Ann Able", "Ben Baker"],
    });
    expect(progress.timeline.decisionDay).toBe(102);
    const rescued = simulation.runTurn(program, bringThemHome, {
      "contingency:test-departure-home": "use",
    });
    expect(rescued.summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(rescued.summary.healthLost).toEqual([
      { name: "Ann Able", lost: [{ cause: "contingency", health: 10 }] },
      { name: "Ben Baker", lost: [{ cause: "contingency", health: 10 }] },
    ]);
    const declined = simulation.runTurn(program, bringThemHome, {
      "contingency:test-departure-home": "decline",
    });
    expect(declined.summary.crewHome).toEqual([]);
    expect(declined.summary.crewLost).toHaveLength(1);
  });
});

describe("Health on the way home", () => {
  /** Radiation only, at the test catalogue's rate in flight and none at Mars. */
  const radiationInFlight = {
    ...steadyHealth,
    radiationPerDay: { inFlight: 0.1, atMars: 0 },
  };

  it("falls to radiation for each day of the journey, which Protection slows", () => {
    const { simulation, program } = atMars([], {
      crewHealth: radiationInFlight,
    });
    // 20 on the way to Mars, then 20 on the way home.
    const { summary } = simulation.runTurn(program, bringThemHome);
    expect(summary.healthLost).toContainEqual({
      name: "Ann Able",
      lost: [{ cause: "radiationInFlight", health: 20 }],
    });
    const shielded = atMars([], {
      crewHealth: radiationInFlight,
      mission: {
        ...roundTrip,
        crew: { size: 2, roundTrip: true, protectionId: "test-shielding" },
      },
    });
    expect(
      shielded.simulation.runTurn(shielded.program, bringThemHome).summary
        .healthLost,
    ).toContainEqual({
      name: "Ann Able",
      lost: [{ cause: "radiationInFlight", health: 10 }],
      savedByProtection: 10,
    });
  });

  it("loses Crew whose Health runs out on the way home to their Health", () => {
    const { simulation, program } = atMars([], {
      crewHealth: {
        ...steadyHealth,
        radiationPerDay: { inFlight: 0.45, atMars: 0 },
      },
    });
    // 90 on the way to Mars leaves 10, which runs out 23 days after leaving.
    const { summary } = simulation.runTurn(program, bringThemHome);
    expect(summary.crewHome).toEqual([]);
    expect(summary.crewLost).toEqual([
      expect.objectContaining({
        names: ["Ann Able", "Ben Baker"],
        cause: "health",
        description:
          "Ann Able and Ben Baker were lost on the way home, when their Health ran out.",
      }),
    ]);
  });

  it("takes the Supplies left in Mars orbit with them, which can run out on the way home", () => {
    // Two Crew use a kilogram a day of the 1,000 they launch with, which leaves 120 as they leave Mars on day 880
    // from launch: 120 days' worth on a journey of 200, which leaves them 80 days with none.
    const { simulation, program } = atMars([], {
      suppliesPerMemberPerDayKg: 0.5,
      crewHealth: { ...steadyHealth, noSuppliesPerDay: 1 },
    });
    const { summary } = simulation.runTurn(program, bringThemHome);
    expect(summary.suppliesRanOut).toEqual([
      { crew: "Crew aboard the Test return stage", on: "2031-08-28" },
    ]);
    expect(summary.healthLost).toContainEqual({
      name: "Ann Able",
      lost: [{ cause: "noSupplies", health: 80 }],
    });
  });
});

describe("Crew home from a Free-return", () => {
  it("earn Public Support for each Crew member home, and the First Crew home Milestone", () => {
    const { simulation, program } = withFailures(["test-arrival"], {
      crewHealth: steadyHealth,
    });
    const { summary } = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: [],
        crew: { size: 2 },
        trajectoryId: "test-free-return",
      },
    });
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(summary.publicSupportForCrewHome).toBe(80);
    expect(summary.milestones.map(({ name }) => name)).toEqual([
      "First Crew home",
    ]);
  });
});
