import type { CatalogueFiles } from "../catalogue/catalogue";

type ServiceLifeOptions =
  CatalogueFiles["assets"][number]["serviceLifeOptions"];

/**
 * The test catalogue's technologies that aren't Flight-proven or need orbital refuelling, with that refuelling's
 * Mission Events, for the tests of Technology Readiness, Development and orbital refuelling.
 */
export function testTechnologies(serviceLifeOptions: ServiceLifeOptions): {
  launchVehicles: CatalogueFiles["launchVehicles"];
  assets: CatalogueFiles["assets"];
  refuellingEvents: CatalogueFiles["missionEvents"];
} {
  return {
    launchVehicles: [
      {
        id: "test-prototype",
        name: "Test Prototype",
        costMillions: 100,
        capacityTonnes: 5,
        missionEvents: ["test-launch", "test-burn"],
        technologyReadiness: "built",
        unproven: { costMillions: 200, failureMultiplier: 2 },
      },
      {
        id: "test-future-vehicle",
        name: "Test Future Vehicle",
        costMillions: 400,
        capacityTonnes: 20,
        missionEvents: ["test-launch", "test-burn"],
        technologyReadiness: "not-built",
        unproven: { costMillions: 600, failureMultiplier: 2 },
        development: { costMillions: 500, turns: 1 },
      },
      {
        id: "test-refuelled",
        name: "Test Refuelled",
        costMillions: 500,
        capacityTonnes: 30,
        missionEvents: [
          "test-launch",
          "test-tanker-launch",
          "test-rendezvous",
          "test-burn",
        ],
        technologyReadiness: "flight-proven",
      },
    ],
    assets: [
      {
        id: "test-new-lander",
        name: "Test New Lander",
        kind: "lander",
        costMillions: 300,
        massTonnes: 3,
        failureChancePerTurn: 0,
        serviceLifeOptions,
        missionEvents: ["test-landing"],
        technologyReadiness: "built",
        unproven: { costMillions: 500, failureMultiplier: 2 },
        activities: ["test-nothing", "test-research"],
        landsAtSite: true,
        landingRiskMultiplier: 0.5,
      },
      {
        id: "test-future-orbiter",
        name: "Test Future Orbiter",
        kind: "orbiter",
        costMillions: 400,
        massTonnes: 2,
        failureChancePerTurn: 0,
        serviceLifeOptions,
        missionEvents: ["test-arrival"],
        technologyReadiness: "not-built",
        unproven: { costMillions: 600, failureMultiplier: 2 },
        development: { costMillions: 300, turns: 2 },
        activities: ["test-survey", "test-nothing", "test-research"],
      },
    ],
    refuellingEvents: [
      {
        id: "test-tanker-launch",
        name: "Test tanker launch",
        description: "The tanker lifts off.",
        failureDescription: "The tanker blew up.",
        timing: { from: "launch", days: 1 },
        failureProbability: 0,
        publicSupportLoss: 25,
      },
      {
        id: "test-rendezvous",
        name: "Test rendezvous",
        description: "Meets the tanker.",
        failureDescription: "It missed the tanker.",
        timing: { from: "launch", days: 2 },
        failureProbability: 0,
        publicSupportLoss: 35,
      },
    ],
  };
}
