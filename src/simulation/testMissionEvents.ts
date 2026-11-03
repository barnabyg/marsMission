import type { CatalogueFiles } from "../catalogue/catalogue";

/**
 * The test catalogue's Mission Events, with orbital refuelling's between the launch and the burn, and the Contingency
 * for each that has one.
 */
export function testMissionEvents(
  refuellingEvents: CatalogueFiles["missionEvents"],
): Pick<CatalogueFiles, "missionEvents" | "contingencies"> {
  return {
    missionEvents: [
      {
        id: "test-launch",
        name: "Test launch",
        description: "Lifts off.",
        failureDescription: "It blew up on the pad.",
        timing: { from: "launch", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 20,
      },
      ...refuellingEvents,
      {
        id: "test-burn",
        name: "Test burn",
        description: "Burns.",
        failureDescription: "The engine cut out.",
        timing: { from: "departure", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 30,
      },
      {
        id: "test-arrival",
        name: "Test arrival",
        description: "Arrives.",
        failureDescription: "It flew straight past.",
        timing: { from: "arrival", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 40,
      },
      {
        id: "test-landing",
        name: "Test landing",
        description: "{lander} touched down at {site}.",
        failureDescription: "{lander} crashed at {site}.",
        timing: { from: "arrival", days: 5 },
        failureProbability: "landingSite",
        publicSupportLoss: 50,
      },
    ],
    contingencies: [
      {
        id: "test-spare-engine",
        name: "Spare engine",
        description: "A second try at the burn.",
        missionEvent: "test-burn",
        costMillions: 20,
        massTonnes: 0.5,
        rescueFailureProbability: 0,
        serviceLifeLossPercent: 10,
        extraPublicSupportLoss: 5,
        troubleDescription: "The engine is cutting out.",
        rescueDescription: "The spare engine fired.",
      },
      {
        id: "test-reserve-fuel",
        name: "Reserve fuel",
        description: "A second try at arriving.",
        missionEvent: "test-arrival",
        costMillions: 50,
        massTonnes: 1,
        rescueFailureProbability: 0,
        serviceLifeLossPercent: 50,
        extraPublicSupportLoss: 10,
        troubleDescription: "It is about to fly past.",
        rescueDescription: "The reserve fuel caught it.",
      },
      {
        id: "test-thrusters",
        name: "Retro thrusters",
        description: "A second try at landing.",
        missionEvent: "test-landing",
        costMillions: 60,
        massTonnes: 0.5,
        rescueFailureProbability: 0,
        serviceLifeLossPercent: 20,
        extraPublicSupportLoss: 15,
        troubleDescription: "{lander} came in too fast at {site}.",
        rescueDescription: "{lander} made a hard landing at {site}.",
      },
    ],
  };
}
