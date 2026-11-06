import { parseCatalogue } from "../src/catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
} from "../src/simulation/simulation";
import { realCatalogueFiles } from "../src/testing/realCatalogue";

/**
 * Seeds and saves for the tests of the Meridian Colossus and the Crew it carries, which need it developed first. Like
 * `seeds.ts`, each searches the real data files for a seed rather than pinning a number.
 */

const catalogue = parseCatalogue(realCatalogueFiles());

/** Enough to develop the Meridian Colossus and then fill it, which a real Program can't afford until later. */
export const colossusMoney = 7000;

const colossusSimulation = createSimulation(
  parseCatalogue({
    ...realCatalogueFiles(),
    program: { ...catalogue.program, startingMoneyMillions: colossusMoney },
  }),
);

/** A Program on this seed at the start of Turn 3, with the Meridian Colossus developed over its first two Turns. */
function colossusBuilt(seed: number): Program {
  const developing = colossusSimulation.runTurn(
    colossusSimulation.startProgram(seed),
    { mission: null, developmentIds: ["meridian-colossus"] },
  );
  return colossusSimulation.runTurn(developing.program, { mission: null })
    .program;
}

/** What the tests launch on the Meridian Colossus once it is built: more mass than any other Launch Vehicle carries. */
const onColossus: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: ["pathfinder-orbiter", "prospector-lander", "trailblazer-rover"],
    landingSiteId: "jezero-crater",
  },
};

/**
 * A seed where the Meridian Colossus, developed over the first two Turns with nothing launched, carries its first
 * Mission with nothing to answer, and the only Mission Event to fail, if any, is the named one.
 */
function colossusSeedWhere(
  failedEvent: string | null,
  plan: TurnPlan = onColossus,
): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const progress = colossusSimulation.workOutTurn(colossusBuilt(seed), plan);
    if (
      !progress.decisionPoint &&
      (progress.result.summary.failure?.missionEventName ?? null) ===
        failedEvent
    ) {
      return seed;
    }
  }
  throw new Error(
    `No seed gives the Meridian Colossus's first Mission the outcome ${failedEvent}`,
  );
}

/**
 * The automatic save of a Program on this seed, with the Meridian Colossus developed over its first two Turns and
 * nothing launched, as the game itself saves it at the start of Turn 3. Loading it skips playing those two Turns, for a
 * test about what comes after. It needs the game's data to give the Program colossusMoney, as overrideProgramData does.
 */
export function colossusBuiltSave(seed: number): string {
  return JSON.stringify(colossusSimulation.saveProgram(colossusBuilt(seed)));
}

/** A seed where the Meridian Colossus carries its first Mission through the tanker launch and the rendezvous to Mars. */
export const colossusSeed = colossusSeedWhere(null);

/** A seed where the Meridian Colossus's first Mission collides with its Tanker at the rendezvous. */
export const rendezvousFailureSeed = colossusSeedWhere("Rendezvous");

/** The smallest Crew on the Meridian Colossus, with nothing else aboard. */
const smallestCrew: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: { size: catalogue.crew.sizes[0]?.crew ?? 0 },
  },
};

/** A seed where the Meridian Colossus carries the smallest Crew to Mars orbit on its first Mission, with nothing to answer. */
export const crewSeed = colossusSeedWhere(null, smallestCrew);

/** A seed where the Meridian Colossus's first Mission fails its launch with the smallest Crew aboard, which loses them. */
export const crewLossSeed = colossusSeedWhere("Launch", smallestCrew);

/**
 * A seed where the Meridian Colossus lands the smallest Crew at the first known Landing Site on its first Mission, as
 * Planning Mode plans it once the Crew are set to land, with nothing to answer.
 */
export const crewLandingSeed = colossusSeedWhere(null, {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: {
      size: catalogue.crew.sizes[0]?.crew ?? 0,
      landsAtSite: true,
      protectionId: "protection-light-shielding",
    },
    landingSiteId: "jezero-crater",
  },
});

/** The smallest Crew on a round trip to Mars orbit aboard the Meridian Colossus, as Planning Mode plans it once ticked. */
const roundTrip: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: { size: catalogue.crew.sizes[0]?.crew ?? 0, roundTrip: true },
  },
};

/**
 * A seed where the Meridian Colossus's first Mission carries the smallest Crew on a round trip to Mars orbit, and on
 * the next Turn, with nothing launched, their journey home brings them home safe, each Turn with nothing to answer.
 */
export const roundTripSeed = (() => {
  for (let seed = 1; seed < 100_000; seed++) {
    const out = colossusSimulation.workOutTurn(colossusBuilt(seed), roundTrip);
    if (out.decisionPoint || out.result.summary.failure) continue;
    const there = out.result.program;
    const bringHome =
      colossusSimulation.readProgram(there).crew[0]?.waysHome[0]?.key;
    if (bringHome === undefined) continue;
    const home = colossusSimulation.workOutTurn(there, {
      mission: null,
      bringHome,
    });
    if (!home.decisionPoint && home.result.summary.crewHome.length > 0) {
      return seed;
    }
  }
  throw new Error("No seed brings round-trip Crew home");
})();

/**
 * A seed where the Meridian Colossus lands the smallest Crew and the Haven Module together at the first known Landing
 * Site on its first Mission, as Planning Mode plans it once both are chosen, with nothing to answer.
 */
export const habitatSeed = colossusSeedWhere(null, {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: ["haven-habitat"],
    crew: { size: catalogue.crew.sizes[0]?.crew ?? 0, landsAtSite: true },
    landingSiteId: "jezero-crater",
  },
});
