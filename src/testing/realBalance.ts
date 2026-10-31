import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { realCatalogueFiles } from "./realCatalogue";

/** The real numbers, with every Mission Event certain to fail or certain to succeed. */
function realSimulation(failureProbability: 0 | 1) {
  const files = realCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability,
      })),
    }),
  );
}

export const failing = realSimulation(1);
export const succeeding = realSimulation(0);
export const files = realCatalogueFiles();

export const mission = {
  launchVehicleId: files.launchVehicles[0]?.id ?? "",
  assetIds: [files.assets[0]?.id ?? ""],
};
export const plainMission: TurnPlan = { mission };
