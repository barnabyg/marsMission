import { describe, expect, it } from "vitest";
import type { Program, Simulation, TurnPlan } from "./simulation";
import type { PlannedMission } from "./types";
import { setup, steadyHealth, withFailures } from "./testHelpers";

/*
 * Mars ascent: round-trip Crew who landed lift off from their Landing Site and dock with their Earth return stage in
 * Mars orbit from the day the journey home leaves Mars, day 100, using 5,000 kg of ascent propellant there. The Test Fuel
 * Plant makes 10 kg a day, so one landing beside them on about day 205 has made 5,750 kg by the next Turn.
 */

/** Round-trip Crew landing at Alpha Plain, with a fuel plant aboard unless the test says otherwise. */
function landing(
  assetIds: string[] = ["test-fuel-plant"],
  contingencyIds: string[] = [],
): PlannedMission {
  return {
    launchVehicleId: "test-heavy",
    assetIds,
    landingSiteId: "alpha-plain",
    contingencyIds,
    crew: { size: 2, roundTrip: true, landsAtSite: true },
  };
}

const stageKey = "earth-return-stage:2029-06-24";
const bringThemHome: TurnPlan = { mission: null, bringHome: stageKey };

/** A Program on its second Turn, with round-trip Crew at Alpha Plain, in a Simulation whose named Mission Events fail. */
function landed(
  failing: string[] = [],
  mission: PlannedMission = landing(),
): { simulation: Simulation; program: Program } {
  const { simulation, program } = withFailures(failing, {
    startingMoneyMillions: 5000,
    crewHealth: steadyHealth,
  });
  return {
    simulation,
    program: simulation.runTurn(program, { mission }).program,
  };
}

const propellantAtAlpha = (simulation: Simulation, program: Program) =>
  simulation
    .readProgram(program)
    .landingSites.find(({ id }) => id === "alpha-plain")?.ascentPropellantKg;

describe("planning a round trip to a Landing Site", () => {
  it("lands round-trip Crew, leaving their Earth return stage in Mars orbit", () => {
    const { simulation, program } = landed();
    const [there] = simulation.readProgram(program).crew;
    expect(there?.locationName).toBe("Alpha Plain");
    expect(there?.waysHome).toEqual([
      {
        key: stageKey,
        names: ["Ann Able", "Ben Baker"],
        leavesMarsOn: "2031-04-30",
        homeOn: "2031-11-16",
        reason: null,
      },
    ]);
  });

  it("lists Mars ascent and the rendezvous before the journey home's Mission Events, with their Contingencies", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
    });
    const events = simulation.previewMission(program, landing());
    expect(
      events
        .filter(({ homeward }) => homeward)
        .map(({ name, contingency }) => [name, contingency?.id ?? null]),
    ).toEqual([
      ["Test ascent", "test-ascent-restart"],
      ["Test docking", null],
      ["Test departure home", "test-backup-engine"],
      ["Test splashdown", null],
    ]);
    expect(
      simulation.validatePlan(program, { mission: landing() }).problems,
    ).toEqual([]);
  });

  it("says how much ascent propellant Mars ascent needs", () => {
    const { simulation, program } = setup();
    expect(
      simulation.readProgram(program).crewedMission.roundTrip
        .ascentPropellantKg,
    ).toBe(5000);
  });
});

describe("bringing Crew home from a Landing Site", () => {
  it("flies Mars ascent on the day the journey leaves Mars, the rendezvous the next day, then the journey home", () => {
    const { simulation, program } = landed();
    const { timeline, summary } = simulation.runTurn(program, bringThemHome);
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "missionEvent" || kind === "crewHome")
        .map(({ day, title }) => [day, title]),
    ).toEqual([
      [100, "Test ascent"],
      [101, "Test docking"],
      [102, "Test departure home"],
      [300, "Test splashdown"],
      [300, "Crew home"],
    ]);
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(summary.publicSupportForCrewHome).toBe(2 * 40);
    expect(summary.milestones.map(({ name }) => name)).toContain(
      "First Crew home",
    );
  });

  it("uses up the ascent propellant Mars ascent needs at their Landing Site, and the Turn summary says so", () => {
    const { simulation, program } = landed();
    expect(propellantAtAlpha(simulation, program)).toBe(5750);
    const { program: next, summary } = simulation.runTurn(
      program,
      bringThemHome,
    );
    expect(summary.ascentPropellantUsed).toEqual([
      { siteName: "Alpha Plain", usedKg: 5000, totalKg: 5750 + 7800 - 5000 },
    ]);
    expect(summary.ascentPropellant).toEqual([
      {
        siteName: "Alpha Plain",
        madeBy: ["Test Fuel Plant"],
        madeKg: 7800,
        totalKg: 8550,
      },
    ]);
    expect(propellantAtAlpha(simulation, next)).toBe(8550);
  });

  it("isn't offered without enough ascent propellant at their Landing Site, and says why", () => {
    const { simulation, program } = landed([], landing([]));
    const reason =
      "Mars ascent from Alpha Plain needs 5.0 t of ascent propellant, but only 0.0 t is there. A fuel plant there makes it.";
    expect(simulation.readProgram(program).crew[0]?.waysHome[0]?.reason).toBe(
      reason,
    );
    expect(simulation.validatePlan(program, bringThemHome).problems).toEqual([
      reason,
    ]);
  });

  it("loses the Crew if Mars ascent fails, and still uses the propellant", () => {
    const { simulation, program } = landed(["test-ascent"]);
    const { program: next, summary } = simulation.runTurn(
      program,
      bringThemHome,
    );
    expect(summary.crewHome).toEqual([]);
    expect(summary.journeyHome).toEqual({
      crew: ["Ann Able", "Ben Baker"],
      failure: { missionEventName: "Test ascent", publicSupportLost: 15 },
    });
    expect(summary.crewLost.flatMap(({ names }) => names)).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
    expect(summary.ascentPropellantUsed[0]?.usedKg).toBe(5000);
    expect(simulation.readProgram(next).crew).toEqual([]);
  });

  it("loses the Crew if the rendezvous fails, before the journey home flies", () => {
    const { simulation, program } = landed(["test-docking"]);
    const { timeline, summary } = simulation.runTurn(program, bringThemHome);
    expect(summary.journeyHome?.failure?.missionEventName).toBe("Test docking");
    expect(
      timeline.entries.some(({ title }) => title === "Test departure home"),
    ).toBe(false);
  });

  it("offers Mars ascent's Contingency, bought at launch, and its rescue brings the Crew home", () => {
    const { simulation, program } = landed(
      ["test-ascent"],
      landing(["test-fuel-plant"], ["test-ascent-restart"]),
    );
    const stopped = simulation.workOutTurn(program, bringThemHome);
    expect(stopped.decisionPoint).toMatchObject({
      kind: "contingency",
      day: 100,
    });
    const { summary } = simulation.runTurn(program, bringThemHome, {
      [stopped.decisionPoint?.id ?? ""]: "use",
    });
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
  });

  it("keeps the Earth return stage in Mars orbit through saving and loading", () => {
    const { simulation, program } = landed();
    const loaded = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(program))),
    );
    expect(simulation.readProgram(loaded).crew[0]?.waysHome[0]?.key).toBe(
      stageKey,
    );
    expect(simulation.runTurn(loaded, bringThemHome).summary.crewHome).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
  });
});
