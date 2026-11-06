import { describe, expect, it } from "vitest";
import {
  addDays,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { steadyHealth, withFailures } from "./testHelpers";

/*
 * The Test Habitat lands holding 400 kg of Supplies. Crew landing on the first Turn land on day 205, and the Turn has
 * 780 days. The Short Supplies are 1,000 kg and the Long ones 2,000 kg.
 */

const landingCrew = {
  launchVehicleId: "test-heavy",
  crew: { size: 2, landsAtSite: true },
  landingSiteId: "alpha-plain",
};
const landCrew = (suppliesId = "test-supplies-short"): TurnPlan => ({
  mission: {
    ...landingCrew,
    assetIds: [],
    crew: { ...landingCrew.crew, suppliesId },
  },
});
const crewWithHabitat: TurnPlan = {
  mission: { ...landingCrew, assetIds: ["test-habitat"] },
};
const sendHabitat: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-habitat"],
    landingSiteId: "alpha-plain",
  },
};

/** Landings that never fail, Crew whose Health never falls, and Supplies used at this rate a Crew member a day. */
const usingSupplies = (kilogramsPerDay = 0.25) =>
  withFailures([], {
    startingMoneyMillions: 5000,
    crewHealth: steadyHealth,
    suppliesPerMemberPerDayKg: kilogramsPerDay,
  });

/** The Supplies held in habitats at each known Landing Site, by name, as Planning Mode shows them. */
function heldAt(simulation: Simulation, program: Program) {
  return Object.fromEntries(
    simulation
      .readProgram(program)
      .landingSites.map(({ name, habitatSuppliesKg }) => [
        name,
        habitatSuppliesKg,
      ]),
  );
}

/** How many days the Supplies of the Crew at Alpha Plain will last them, with those in any habitat there. */
const daysLeft = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).crew[0]?.suppliesDaysLeft;

/** The habitat at Mars, by its key, to end its mission. */
const habitatKey = (simulation: Simulation, program: Program) =>
  simulation
    .readProgram(program)
    .operatingAssets.find(({ kind }) => kind === "habitat")?.key ?? "";

describe("a habitat's Supplies", () => {
  it("land with it, full, and stay there while no Crew use them", () => {
    const { simulation, program } = usingSupplies();
    expect(heldAt(simulation, program)).toEqual({
      "Alpha Plain": 0,
      "Beta Crater": 0,
    });
    const landed = simulation.runTurn(program, sendHabitat).program;
    expect(heldAt(simulation, landed)).toEqual({
      "Alpha Plain": 400,
      "Beta Crater": 0,
    });
    const later = simulation.runTurn(landed, { mission: null }).program;
    expect(heldAt(simulation, later)["Alpha Plain"]).toBe(400);
  });

  it("are drawn on by Crew there once their own run out", () => {
    const without = usingSupplies(1);
    const withIt = usingSupplies(1);
    // Two Crew use 2 kg a day: 410 kg on the way, so the 590 kg left at Mars run out 295 days after landing.
    expect(
      without.simulation.runTurn(without.program, landCrew()).summary
        .suppliesRanOut,
    ).toEqual([
      { crew: "Crew in Alpha Plain", on: addDays("2028-12-01", 205 + 295) },
    ]);
    // The habitat's 400 kg last them 200 days more.
    expect(
      withIt.simulation.runTurn(withIt.program, crewWithHabitat).summary
        .suppliesRanOut,
    ).toEqual([
      {
        crew: "Crew in Alpha Plain",
        on: addDays("2028-12-01", 205 + 295 + 200),
      },
    ]);
  });

  it("count towards the days the Supplies of the Crew there will last", () => {
    const { simulation, program } = usingSupplies();
    const landed = simulation.runTurn(program, crewWithHabitat).program;
    // 1,000 kg less half a kilogram a day for 780 days leaves 610 kg, and the habitat holds its 400 kg.
    expect(heldAt(simulation, landed)["Alpha Plain"]).toBe(400);
    expect(daysLeft(simulation, landed)).toBe((610 + 400) / 0.5);
  });

  it("are topped up by Crew landing there with Supplies of their own, up to what it holds", () => {
    const { simulation, program } = usingSupplies(0.5);
    // A Crew of two uses a kilogram a day: 795 kg and the habitat's 400 kg are 1,195 kg on landing, 620 kg at the end.
    const first = simulation.runTurn(program, crewWithHabitat).program;
    expect(heldAt(simulation, first)["Alpha Plain"]).toBe(400);
    // A whole Turn uses 780 kg, which empties the habitat too.
    const empty = simulation.runTurn(first, { mission: null }).program;
    expect(heldAt(simulation, empty)["Alpha Plain"]).toBe(0);
    // Two more land with 1,795 kg, and four use 2 kg a day for 575 days, which leaves 645 kg, 400 of it in the habitat.
    const refilled = simulation.runTurn(
      empty,
      landCrew("test-supplies-long"),
    ).program;
    expect(heldAt(simulation, refilled)["Alpha Plain"]).toBe(400);
    expect(daysLeft(simulation, refilled)).toBe(Math.floor(645 / 2));
  });

  it("stay with the Crew there when the habitat stops", () => {
    const { simulation, program } = usingSupplies();
    const landed = simulation.runTurn(program, crewWithHabitat).program;
    const stopped = simulation.runTurn(landed, {
      mission: null,
      endedAssetKeys: [habitatKey(simulation, landed)],
    }).program;
    expect(heldAt(simulation, stopped)["Alpha Plain"]).toBe(0);
    expect(daysLeft(simulation, stopped)).toBe((610 + 400) / 0.5 - 780);
  });

  it("go with the habitat when it stops with no Crew there", () => {
    const { simulation, program } = usingSupplies();
    const landed = simulation.runTurn(program, sendHabitat).program;
    const stopped = simulation.runTurn(landed, {
      mission: null,
      endedAssetKeys: [habitatKey(simulation, landed)],
    }).program;
    expect(heldAt(simulation, stopped)["Alpha Plain"]).toBe(0);
    const crewLater = simulation.runTurn(stopped, landCrew()).program;
    expect(daysLeft(simulation, crewLater)).toBe((1000 - 0.5 * 780) / 0.5);
  });
});

describe("saving a habitat's Supplies", () => {
  it("restores exactly the Supplies that were saved", () => {
    const { simulation, program } = usingSupplies();
    const landed = simulation.runTurn(program, sendHabitat).program;
    const saved = JSON.parse(
      JSON.stringify(simulation.saveProgram(landed)),
    ) as unknown;
    const restored = simulation.restoreProgram(saved);
    expect(restored).toEqual(landed);
    expect(heldAt(simulation, restored)["Alpha Plain"]).toBe(400);
  });

  it("upgrades a save from before habitats with none at any Landing Site", () => {
    const { simulation } = usingSupplies();
    // A literal copy of what format 10 looks like. Don't change this: it's a compatibility contract.
    const formatTen = {
      formatVersion: 10,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [
          {
            assetId: "test-fuel-plant",
            name: "Test Fuel Plant",
            kind: "fuel-plant",
            arrivedOn: "2029-06-19",
            landingSiteId: "alpha-plain",
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-nothing",
            flewUnproven: false,
          },
        ],
        crew: [],
        crewActivities: {},
        crewSupplies: {},
        earthReturnStages: [],
        ascentPropellantKg: { "alpha-plain": 5800 },
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatTen);
    expect(heldAt(simulation, restored)).toEqual({
      "Alpha Plain": 0,
      "Beta Crater": 0,
    });
    const next = simulation.runTurn(restored, sendHabitat).program;
    expect(heldAt(simulation, next)["Alpha Plain"]).toBe(400);
  });
});
