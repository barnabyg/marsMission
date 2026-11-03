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

/** Crew Health that never falls, for the tests of Crew that aren't about Health. */
export const steadyHealth: CatalogueFiles["crew"]["health"] = {
  radiationPerDay: { inFlight: 0, atMars: 0 },
  timeAtMarsPerDay: 0,
  contingencyRescueLoss: 0,
  dustStorm: { chance: 0, loss: 0 },
};

/** A Simulation whose named Mission Events always fail and whose others never do, with these changes. */
export function withFailures(
  failing: string[],
  {
    rescueFailureProbability = 0,
    startingMoneyMillions,
    crewHealth,
  }: {
    rescueFailureProbability?: number;
    startingMoneyMillions?: number;
    crewHealth?: Partial<CatalogueFiles["crew"]["health"]>;
  } = {},
) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      crew: {
        ...files.crew,
        health: { ...files.crew.health, ...crewHealth },
      },
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
