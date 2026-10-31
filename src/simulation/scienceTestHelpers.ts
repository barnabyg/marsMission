import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";

export function scienceMilestone(
  totalScience: number,
  { science = 0, publicSupport = 0 } = {},
) {
  return {
    id: `science-${totalScience}`,
    name: `${totalScience} Science`,
    description: "A lot of Science.",
    trigger: { totalScience },
    science,
    publicSupport,
  };
}

/** The Test Catalogue with these Milestones as well, and these Funding Thresholds in place of its own. */
export function simulationWith(
  milestones: ReturnType<typeof scienceMilestone>[],
  fundingThresholds?: CatalogueFiles["fundingThresholds"],
  files = testCatalogueFiles(),
) {
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      milestones: [...files.milestones, ...milestones],
      fundingThresholds: fundingThresholds ?? files.fundingThresholds,
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

/** An orbiter that arrives on day 200 for the 100 Science of First orbiter, and then earns 0.1 Science and 0.05 Public Support a day. */
export const researchingOrbiter: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    assetChoices: { "test-orbiter": { activityId: "test-research" } },
  },
};
