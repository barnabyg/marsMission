import type { CatalogueFiles } from "../catalogue/catalogue";

/**
 * The test catalogue's Crewed Mission, for the tests of Crew. Even its smaller Crew is too heavy for the Test Vehicle
 * but fits the Test Heavy, and its names run out after two Crews of two.
 */
export function testCrew(): CatalogueFiles["crew"] {
  return {
    vehicleName: "Test Crew Ship",
    missionEvents: ["test-arrival"],
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
    },
    publicSupportLossPerMember: 20,
    orbitActivities: ["test-research", "test-nothing"],
    names: ["Ann Able", "Ben Baker", "Cal Cole", "Dee Dunn", "Eve Eng"],
  };
}
