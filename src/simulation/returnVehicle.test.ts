import { describe, expect, it } from "vitest";
import type { Program, Simulation, TurnPlan } from "./simulation";
import type { PlannedMission } from "./types";
import { setup, steadyHealth, withFailures } from "./testHelpers";

/*
 * A return vehicle fetches Crew already at Mars: the Test return vehicle weighs 2 t, costs 400 and has room for two. It
 * reaches Mars orbit through the Test arrival, as Crew do, and waits there for the Crew it was sent for, who come home in
 * it on a later Turn as round-trip Crew do.
 */

const oneWay: PlannedMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};

/** A return vehicle on its own, on the Test Vehicle, for the Crew in this place at Mars. */
const fetching = (forCrewAt = "mars-orbit"): PlannedMission => ({
  launchVehicleId: "test-vehicle",
  assetIds: [],
  returnVehicle: { forCrewAt },
});

/** A Program on its second Turn with one-way Crew at Mars, in a Simulation whose named Mission Events fail. */
function crewOneWay(
  failing: string[] = [],
  mission: PlannedMission = oneWay,
): { simulation: Simulation; program: Program } {
  const { simulation, program } = withFailures(failing, {
    startingMoneyMillions: 6000,
    crewHealth: steadyHealth,
  });
  return {
    simulation,
    program: simulation.runTurn(program, { mission }).program,
  };
}

/** The keys of the ways home on offer, by place. */
const waysHome = (simulation: Simulation, program: Program) =>
  simulation
    .readProgram(program)
    .crew.map(({ key, waysHome: ways }) => [key, ways.map((way) => way.names)]);

/** The one way home on offer, which a later Turn's plan names to bring its Crew home. */
const onlyWayHome = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).crew.flatMap((there) => there.waysHome)[0]
    ?.key ?? "";

describe("planning a return vehicle", () => {
  it("offers a return vehicle with its cost, mass and room for Crew", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).crewedMission.returnVehicle).toEqual(
      {
        name: "Test return vehicle",
        description: "Fetches Crew.",
        costMillions: 400,
        massTonnes: 2,
        crewRoom: 2,
      },
    );
  });

  it("says which Crew at Mars have no way home, whom a return vehicle can fetch", () => {
    const { simulation, program } = crewOneWay();
    expect(simulation.readProgram(program).crew).toEqual([
      expect.objectContaining({
        key: "mars-orbit",
        withoutWayHome: ["Ann Able", "Ben Baker"],
        waysHome: [],
      }),
    ]);
    const roundTrip = crewOneWay([], {
      ...oneWay,
      crew: { size: 2, roundTrip: true },
    });
    expect(
      roundTrip.simulation.readProgram(roundTrip.program).crew[0]
        ?.withoutWayHome,
    ).toEqual([]);
  });

  it("adds its cost and mass to a Mission that carries nothing else", () => {
    const { simulation, program } = crewOneWay();
    expect(
      simulation.validatePlan(program, { mission: fetching() }),
    ).toMatchObject({ costMillions: 100 + 400, massTonnes: 2, problems: [] });
  });

  it("lists the journey home's Mission Events after its own, with their Reliability and Contingency", () => {
    const { simulation, program } = crewOneWay();
    const events = simulation.previewMission(program, fetching());
    expect(events.map(({ name, homeward }) => [name, homeward])).toEqual([
      ["Test launch", false],
      ["Test burn", false],
      ["Test arrival", false],
      ["Test departure home", true],
      ["Test splashdown", true],
    ]);
    expect(
      simulation.validatePlan(program, {
        mission: {
          ...fetching(),
          reliability: { "test-splashdown": "tested" },
          contingencyIds: ["test-backup-engine", "test-reserve-fuel"],
        },
      }),
    ).toMatchObject({
      costMillions: 100 + 400 + 50 + 40 + 50,
      problems: [],
    });
  });

  it("rejects one for a place with no Crew lacking a way home", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, { mission: fetching() }).problems,
    ).toEqual(['There are no Crew at Mars at "mars-orbit".']);
    const roundTrip = crewOneWay([], {
      ...oneWay,
      crew: { size: 2, roundTrip: true },
    });
    expect(
      roundTrip.simulation.validatePlan(roundTrip.program, {
        mission: fetching(),
      }).problems,
    ).toEqual(["There are no Crew in Mars orbit without a way home to fetch."]);
    expect(
      simulation.validatePlan(program, {
        mission: fetching("landing-site:nowhere"),
      }).problems,
    ).toEqual(['There are no Crew at Mars at "landing-site:nowhere".']);
  });

  it("rejects one without room for the Crew it is for", () => {
    const { simulation, program } = crewOneWay([], {
      ...oneWay,
      crew: { size: 3 },
    });
    expect(
      simulation.validatePlan(program, { mission: fetching() }).problems,
    ).toEqual([
      "The Test return vehicle has room for 2 Crew, but 3 in Mars orbit have no way home.",
    ]);
  });

  it("can't go with a round trip, because a Crewed Mission that carries one leaves its own Crew at Mars", () => {
    const { simulation, program } = crewOneWay();
    expect(
      simulation.validatePlan(program, {
        mission: {
          ...fetching(),
          launchVehicleId: "test-heavy",
          crew: { size: 2, roundTrip: true },
        },
      }).problems,
    ).toContain(
      "A Crewed Mission that carries a return vehicle leaves its own Crew at Mars, so it can't make a round trip too.",
    );
  });
});

describe("a return vehicle at Mars", () => {
  it("waits in Mars orbit for the Crew it was sent for, who can come home on a later Turn", () => {
    const { simulation, program } = crewOneWay();
    const fetched = simulation.runTurn(program, { mission: fetching() });
    expect(waysHome(simulation, fetched.program)).toEqual([
      ["mars-orbit", [["Ann Able", "Ben Baker"]]],
    ]);
    expect(fetched.summary.returnVehicle).toEqual({
      name: "Test return vehicle",
      crew: ["Ann Able", "Ben Baker"],
    });
    expect(
      fetched.timeline.entries.find(
        ({ kind }) => kind === "returnVehicleArrived",
      ),
    ).toMatchObject({
      day: 200,
      title: "Test return vehicle in Mars orbit",
      description:
        "The Test return vehicle waits in Mars orbit to bring Ann Able and Ben Baker home on a later Turn.",
    });
    expect(fetched.timeline.mission?.assets).toEqual([
      {
        name: "Test return vehicle",
        kind: "return vehicle",
        landingSiteName: null,
        deliveredOnDay: 200,
        lostOnDay: null,
        crashed: false,
      },
    ]);
    const home = simulation.runTurn(fetched.program, {
      mission: null,
      bringHome: onlyWayHome(simulation, fetched.program),
    });
    expect(home.summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(simulation.readProgram(home.program).crew).toEqual([]);
  });

  it("is lost if it doesn't reach Mars orbit, leaving its Crew without a way home", () => {
    const { simulation, program } = crewOneWay();
    const failing = withFailures(["test-arrival"], {
      startingMoneyMillions: 6000,
      crewHealth: steadyHealth,
    }).simulation;
    const lost = failing.runTurn(program, { mission: fetching() });
    expect(lost.summary.returnVehicle).toBeNull();
    expect(lost.summary.failure?.assetsLost).toEqual(["Test return vehicle"]);
    expect(waysHome(simulation, lost.program)).toEqual([["mars-orbit", []]]);
  });

  it("is named at stake when its arrival needs a Contingency", () => {
    const { program } = crewOneWay();
    const failing = withFailures(["test-arrival"], {
      startingMoneyMillions: 6000,
      crewHealth: steadyHealth,
    }).simulation;
    const turn = failing.workOutTurn(program, {
      mission: { ...fetching(), contingencyIds: ["test-reserve-fuel"] },
    });
    expect(turn.decisionPoint?.assets).toEqual(["Test return vehicle"]);
  });

  it("brings fetched Crew at a Landing Site home through Mars ascent once there is ascent propellant there", () => {
    const { simulation, program } = crewOneWay([], {
      ...oneWay,
      landingSiteId: "alpha-plain",
      crew: { size: 2, landsAtSite: true },
    });
    const forSite = fetching("landing-site:alpha-plain");
    expect(
      simulation
        .previewMission(program, forSite)
        .filter(({ homeward }) => homeward)
        .map(({ name }) => name),
    ).toEqual([
      "Test ascent",
      "Test docking",
      "Test departure home",
      "Test splashdown",
    ]);
    const fetched = simulation.runTurn(program, {
      mission: { ...forSite, contingencyIds: ["test-ascent-restart"] },
    }).program;
    const [way] = simulation.readProgram(fetched).crew[0]?.waysHome ?? [];
    expect(way?.reason).toBe(
      "Mars ascent from Alpha Plain needs 5.0 t of ascent propellant, but only 0.0 t is there. A fuel plant there makes it.",
    );
    const fuelled: Program = {
      ...fetched,
      ascentPropellantKg: { "alpha-plain": 5000 },
    };
    const home = simulation.runTurn(fuelled, {
      mission: null,
      bringHome: way?.key ?? "",
    });
    expect(home.summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(home.summary.ascentPropellantUsed).toEqual([
      expect.objectContaining({ siteName: "Alpha Plain", usedKg: 5000 }),
    ]);
  });
});

describe("a Crewed Mission with a return vehicle", () => {
  it("swaps Crew: its own stay at Mars one way, and those it fetched can come home", () => {
    const { simulation, program } = crewOneWay();
    const swap: PlannedMission = {
      ...fetching(),
      launchVehicleId: "test-heavy",
      crew: { size: 2 },
    };
    expect(simulation.validatePlan(program, { mission: swap })).toMatchObject({
      costMillions: 300 + 1000 + 100 + 400,
      massTonnes: 6 + 1 + 2,
    });
    const swapped = simulation.runTurn(program, { mission: swap }).program;
    expect(simulation.readProgram(swapped).crew).toEqual([
      expect.objectContaining({
        members: [
          expect.objectContaining({ name: "Ann Able" }),
          expect.objectContaining({ name: "Ben Baker" }),
          expect.objectContaining({ name: "Cal Cole" }),
          expect.objectContaining({ name: "Dee Dunn" }),
        ],
        withoutWayHome: ["Cal Cole", "Dee Dunn"],
        waysHome: [
          expect.objectContaining({ names: ["Ann Able", "Ben Baker"] }),
        ],
      }),
    ]);
    const home = simulation.runTurn(swapped, {
      mission: null,
      bringHome: onlyWayHome(simulation, swapped),
    });
    expect(home.summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(
      simulation
        .readProgram(home.program)
        .crew[0]?.members.map(({ name }) => name),
    ).toEqual(["Cal Cole", "Dee Dunn"]);
  });
});

describe("one-way Crew from a save before round trips", () => {
  it("can be fetched and brought home", () => {
    const { simulation } = withFailures([], {
      crewHealth: steadyHealth,
    });
    // A literal copy of what format 8 looks like. Don't change this: it's a compatibility contract.
    const formatEight = {
      formatVersion: 8,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 900,
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
        ],
        crewActivities: { "mars-orbit": "test-research" },
        crewSupplies: { "mars-orbit": 500 },
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatEight);
    const fetched = simulation.runTurn(restored, {
      mission: fetching(),
    }).program;
    const home = simulation.runTurn(fetched, {
      mission: null,
      bringHome: onlyWayHome(simulation, fetched),
    } satisfies TurnPlan);
    expect(home.summary.crewHome).toEqual(["Ann Able"]);
  });
});
