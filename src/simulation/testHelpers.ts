import { createSimulation, type TurnPlan } from "./simulation";
import type { CatalogueFiles } from "../catalogue/catalogue";
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
