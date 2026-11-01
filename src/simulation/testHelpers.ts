import { createSimulation, type TurnPlan } from "./simulation";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { testCatalogue, testCatalogueFiles } from "./testCatalogue";

export const sendOrbiter: TurnPlan = {
  mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
};

export const sendLander: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-lander"],
    landingSiteId: "alpha-plain",
  },
};

export const skipTurn: TurnPlan = { mission: null };

/** A Simulation whose named Mission Events always fail and whose others never do, with these changes. */
export function withFailures(
  failing: string[],
  {
    rescueFailureProbability = 0,
    startingMoneyMillions,
  }: { rescueFailureProbability?: number; startingMoneyMillions?: number } = {},
) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      program: {
        ...files.program,
        startingMoneyMillions:
          startingMoneyMillions ?? files.program.startingMoneyMillions,
      },
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: failing.includes(event.id) ? 1 : 0,
      })),
      contingencies: files.contingencies.map((contingency) => ({
        ...contingency,
        rescueFailureProbability,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

export function setup() {
  const simulation = createSimulation(testCatalogue());
  return { simulation, program: simulation.startProgram(42) };
}

/** The Test Catalogue with no risk at any Landing Site. */
export function safeLandingFiles(): CatalogueFiles {
  const files = testCatalogueFiles();
  return {
    ...files,
    landingSites: files.landingSites.map((site) => ({
      ...site,
      landingRisk: 0,
    })),
  };
}
