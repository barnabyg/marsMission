import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };

describe("planning a Crewed Mission", () => {
  it("offers each Crew size, Supplies and Protection with what they weigh and cost, and the Health Crew start with", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).crewedMission).toEqual({
      vehicleName: "Test Crew Ship",
      sizes: [
        { crew: 2, costMillions: 1000, massTonnes: 6 },
        { crew: 3, costMillions: 1200, massTonnes: 8 },
      ],
      supplies: [
        {
          id: "test-supplies-short",
          name: "Short",
          costMillions: 100,
          massTonnes: 1,
        },
        {
          id: "test-supplies-long",
          name: "Long",
          costMillions: 200,
          massTonnes: 2,
        },
      ],
      protection: [
        {
          id: "test-protection-none",
          name: "None",
          costMillions: 0,
          massTonnes: 0,
          radiationCutPercent: 0,
        },
        {
          id: "test-shielding",
          name: "Shielding",
          costMillions: 100,
          massTonnes: 1,
          radiationCutPercent: 50,
        },
      ],
      maxHealth: 100,
      namesLeft: 5,
      roundTrip: {
        name: "Test return stage",
        description: "Brings the Crew home.",
        costMillions: 500,
        massTonnes: 1,
        ascentPropellantKg: 5000,
      },
      returnVehicle: {
        name: "Test return vehicle",
        description: "Fetches Crew.",
        costMillions: 400,
        massTonnes: 2,
        crewRoom: 2,
      },
    });
  });

  it("adds the cost and mass of the Crew size and the least Supplies to the Mission's", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendCrew)).toMatchObject({
      costMillions: 300 + 1000 + 100,
      massTonnes: 6 + 1,
      problems: [],
    });
    const larger = { mission: { ...crewMission, crew: { size: 3 } } };
    expect(simulation.validatePlan(program, larger)).toMatchObject({
      costMillions: 300 + 1200 + 100,
      massTonnes: 8 + 1,
    });
  });

  it("rejects a Crewed Mission that is too heavy for its Launch Vehicle", () => {
    const { simulation, program } = setup();
    const onSmall = {
      mission: { ...crewMission, launchVehicleId: "test-vehicle" },
    };
    expect(simulation.validatePlan(program, onSmall).problems).toEqual([
      "This Mission weighs 7 tonnes, but its Launch Vehicle can only carry 5 tonnes.",
    ]);
  });

  it("carries Assets as well as Crew, within its Launch Vehicle's mass", () => {
    const { simulation, program } = setup();
    const both = { mission: { ...crewMission, assetIds: ["test-relay"] } };
    expect(simulation.validatePlan(program, both)).toMatchObject({
      massTonnes: 9,
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
      `Crew in Mars orbit can't do the Activity "Survey".`,
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
