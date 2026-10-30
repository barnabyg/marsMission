import { parseCatalogue } from "../src/catalogue/catalogue";
import { createSimulation } from "../src/simulation/simulation";
import { realCatalogueFiles } from "../src/testing/realCatalogue";

const catalogue = parseCatalogue(realCatalogueFiles());
const simulation = createSimulation(catalogue);

/** What Planning Mode offers first, which is what the tests launch. */
const firstPlan = {
  mission: {
    launchVehicleId: catalogue.launchVehicles[0]?.id ?? "",
    assetIds: [catalogue.assets[0]?.id ?? ""],
  },
};

/**
 * Finds a seed from the real data files instead of pinning a number, so tuning a failure
 * probability can't quietly change what these tests are exercising.
 */
function seedWhere(failedEvent: string | null): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const { summary } = simulation.runTurn(
      simulation.startProgram(seed),
      firstPlan,
    );
    if ((summary.failure?.missionEventName ?? null) === failedEvent) {
      return seed;
    }
  }
  throw new Error(`No seed gives the first Mission the outcome ${failedEvent}`);
}

/** A seed whose first Mission succeeds. */
export const successSeed = seedWhere(null);

/** A seed whose first Mission fails at the named Mission Event. */
export const seedFailingAt = (missionEventName: string) =>
  seedWhere(missionEventName);
