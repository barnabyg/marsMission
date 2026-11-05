import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import {
  calmCatalogueFiles,
  realCatalogueFiles,
} from "../testing/realCatalogue";
import type { Strategy } from "./strategy";

// Fixtures shared by the tests of balance runs and of their report.

export const files = realCatalogueFiles();
export const simulationOf = (catalogueFiles: CatalogueFiles) =>
  createSimulation(parseCatalogue(catalogueFiles));
export const real = simulationOf(files);
export const turns = 20;
export const launchNothing: Strategy = {
  name: "test: launch nothing",
  description: "Never launches.",
  plan: () => ({ mission: null }),
};

/** With nothing able to fail, so that a test can work out what must happen. */
export const certain: CatalogueFiles = {
  ...calmCatalogueFiles(),
  assets: files.assets.map((asset) => ({
    ...asset,
    failureChancePerTurn: 0,
  })),
  missionEvents: files.missionEvents.map((event) => ({
    ...event,
    failureProbability: 0,
  })),
};

/** Nothing fails, and the Meridian Colossus is built and Flight-proven from the start, so Crew can fly on Turn 1. */
export const colossusFromTheStart = {
  ...certain,
  program: { ...certain.program, startingMoneyMillions: 20_000 },
  launchVehicles: certain.launchVehicles.map(
    ({ id, name, costMillions, capacityTonnes, missionEvents }) => ({
      id,
      name,
      costMillions,
      capacityTonnes,
      missionEvents,
      technologyReadiness: "flight-proven" as const,
    }),
  ),
};
