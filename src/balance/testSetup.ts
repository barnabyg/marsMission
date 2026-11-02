import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import {
  calmCatalogueFiles,
  realCatalogueFiles,
} from "../testing/realCatalogue";
import type { Strategy } from "./playStyle";

// Shared by the tests of balance runs and of their report.

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
