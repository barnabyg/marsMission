import { parseCatalogue } from "../src/catalogue/catalogue";
import {
  createSimulation,
  type TurnPlan,
  type TurnSummary,
} from "../src/simulation/simulation";
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
function seedWhere(
  failedEvent: string | null,
  plan: TurnPlan = firstPlan,
): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const { summary } = simulation.runTurn(simulation.startProgram(seed), plan);
    if ((summary.failure?.missionEventName ?? null) === failedEvent) {
      return seed;
    }
  }
  throw new Error(`No seed gives the first Mission the outcome ${failedEvent}`);
}

/** What the tests launch to land at the first known Landing Site. */
const firstLanding: TurnPlan = {
  mission: {
    launchVehicleId: catalogue.launchVehicles[0]?.id ?? "",
    assetIds: ["prospector-lander"],
    landingSiteId: "jezero-crater",
  },
};

/** A seed whose first Mission lands at the first known Landing Site. */
export const landingSeed = seedWhere(null, firstLanding);

/** A seed whose first Mission crashes at the first known Landing Site. */
export const crashSeed = seedWhere("Entry/descent/landing", firstLanding);

/** What the tests launch to carry an orbiter and a lander together. */
const orbiterAndLander: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-heavy",
    assetIds: ["pathfinder-orbiter", "prospector-lander"],
    landingSiteId: "jezero-crater",
  },
};

/** A seed where an orbiter and lander launched together get as far as the lander crashing. */
export const orbiterSafeSeed = seedWhere(
  "Entry/descent/landing",
  orbiterAndLander,
);

/** A seed where the first orbiter arrives, and what happens to it during the next Turn is as asked. */
function seedWhereOrbiter(nextTurn: (summary: TurnSummary) => boolean): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const first = simulation.runTurn(simulation.startProgram(seed), firstPlan);
    if (first.summary.failure) continue;
    const second = simulation.runTurn(first.program, { mission: null });
    if (nextTurn(second.summary)) return seed;
  }
  throw new Error("No seed gives the orbiter that outcome");
}

/** A seed where the first orbiter arrives and fails in service during the next Turn. */
export const orbiterFailsInServiceSeed = seedWhereOrbiter(
  ({ assetsFailed }) => assetsFailed.length > 0,
);

/** A seed where the first orbiter arrives and outlasts its Service Life without failing. */
export const orbiterLastsSeed = seedWhereOrbiter(
  ({ assetsEnded }) => assetsEnded.length > 0,
);

/** A seed whose first Mission succeeds. */
export const successSeed = seedWhere(null);

/** A seed whose first Mission fails at the named Mission Event. */
export const seedFailingAt = (missionEventName: string) =>
  seedWhere(missionEventName);
