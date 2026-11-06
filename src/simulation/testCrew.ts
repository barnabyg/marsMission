import type { CatalogueFiles } from "../catalogue/catalogue";

/**
 * The test catalogue's Crewed Mission, for the tests of Crew. Even its smaller Crew is too heavy for the Test Vehicle
 * but fits the Test Heavy, and its names run out after two Crews of two.
 */
export function testCrew(): CatalogueFiles["crew"] {
  return {
    vehicleName: "Test Crew Ship",
    missionEvents: ["test-arrival"],
    landingMissionEvents: ["test-arrival", "test-landing"],
    sizes: [
      { crew: 2, costMillions: 1000, massTonnes: 6 },
      { crew: 3, costMillions: 1200, massTonnes: 8 },
    ],
    maxHealth: 100,
    // 20 Health on a Slow Trajectory's 200 days, 12 on a Fast one's 120, and 39 a cause in a whole Turn at Mars.
    health: {
      radiationPerDay: { inFlight: 0.1, atMars: 0.05 },
      timeAtMarsPerDay: 0.05,
      contingencyRescueLoss: 10,
      // No one is hurt in a dust storm unless a test says so.
      dustStorm: { chance: 0, loss: 30 },
      noSuppliesPerDay: 1,
      // Halved by the Shielding.
      solarParticleEvent: { safeModeLoss: 10, hitLoss: 40 },
    },
    // The Shielding halves radiation's harm: 10 Health on a Slow Trajectory rather than 20.
    protection: [
      {
        id: "test-protection-none",
        name: "None",
        massTonnes: 0,
        costMillions: 0,
        radiationCutPercent: 0,
      },
      {
        id: "test-shielding",
        name: "Shielding",
        massTonnes: 1,
        costMillions: 100,
        radiationCutPercent: 50,
      },
    ],
    // A Crew of two uses half a kilogram a day, so the Short Supplies last them 2,000 days, longer than any test
    // follows them unless it uses them faster.
    supplies: {
      usePerMemberPerDayKg: 0.25,
      options: [
        {
          id: "test-supplies-short",
          name: "Short",
          massTonnes: 1,
          costMillions: 100,
        },
        {
          id: "test-supplies-long",
          name: "Long",
          massTonnes: 2,
          costMillions: 200,
        },
      ],
    },
    publicSupportLossPerMember: 20,
    // The journey home leaves Mars on day 100 of the Turn, fires for home on day 102 and splashes down on day 300, 200
    // days in flight: 20 Health to radiation with no Protection, and 100 kilograms of Supplies for a Crew of two.
    roundTrip: {
      name: "Test return stage",
      description: "Brings the Crew home.",
      costMillions: 500,
      massTonnes: 1,
      leavesMarsOnDay: 100,
      missionEvents: ["test-departure-home", "test-splashdown"],
      // Crew who landed lift off on the day the journey leaves Mars and dock with the stage the next day, using 5,000
      // kg of ascent propellant at their site, less than the Test Fuel Plant makes in a whole Turn.
      ascent: {
        missionEvents: ["test-ascent", "test-docking"],
        propellantKg: 5000,
      },
    },
    // Light enough to fly on the Test Vehicle on its own, and beside the smaller Crew on the Test Heavy, with room for
    // one Crew of two.
    returnVehicle: {
      name: "Test return vehicle",
      description: "Fetches Crew.",
      costMillions: 400,
      massTonnes: 2,
      crewRoom: 2,
      missionEvents: ["test-arrival"],
    },
    publicSupportPerMemberHome: 40,
    orbitActivities: ["test-research", "test-nothing"],
    // Twice the rate of research in orbit, as a test of earning at the surface's own rates.
    surfaceActivities: ["test-traverse", "test-nothing"],
    names: ["Ann Able", "Ben Baker", "Cal Cole", "Dee Dunn", "Eve Eng"],
  };
}
