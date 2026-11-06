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

/** The real data files with this much money to start a Program with. */
const simulationWith = (startingMoneyMillions: number) =>
  createSimulation(
    parseCatalogue({
      ...realCatalogueFiles(),
      program: { ...catalogue.program, startingMoneyMillions },
    }),
  );

const colossusSimulation = simulationWith(colossusMoney);

/** A Program on this seed at the start of Turn 3, with the Meridian Colossus developed over its first two Turns. */
function colossusBuilt(seed: number, simulation = colossusSimulation): Program {
  const developing = simulation.runTurn(simulation.startProgram(seed), {
    mission: null,
    developmentIds: ["meridian-colossus"],
  });
  return simulation.runTurn(developing.program, { mission: null }).program;
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
const crewLanding: TurnPlan = {
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
};
export const crewLandingSeed = colossusSeedWhere(null, crewLanding);

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

/** Enough to land a fuel plant on Turn 3 and round-trip Crew beside it on Turn 4. */
export const fuelPlantColossusMoney = 12_000;

const richSimulation = simulationWith(fuelPlantColossusMoney);

/** The Wellspring Fuel Plant landing at Jezero Crater on the Meridian Heavy. */
const fuelPlantToJezero: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-heavy",
    assetIds: ["wellspring-fuel-plant"],
    landingSiteId: "jezero-crater",
  },
};

/** A Program on this seed at the start of Turn 4, with the Meridian Colossus built and a fuel plant at Jezero Crater. */
function fuelPlantLanded(seed: number): Program {
  return richSimulation.runTurn(
    colossusBuilt(seed, richSimulation),
    fuelPlantToJezero,
  ).program;
}

/**
 * The automatic save of a Program on this seed at the start of Turn 4, with the Meridian Colossus developed over its
 * first two Turns and the Wellspring Fuel Plant landed at Jezero Crater on the third, as the game saves it. It needs the
 * game's data to give the Program fuelPlantColossusMoney, as overrideProgramData does.
 */
export function fuelPlantLandedSave(seed: number): string {
  return JSON.stringify(richSimulation.saveProgram(fuelPlantLanded(seed)));
}

/**
 * A seed where the Wellspring Fuel Plant lands at Jezero Crater on Turn 3, the smallest Crew land beside it on a round
 * trip on Turn 4, as Planning Mode plans it once the Crew are set to land with Light shielding, and on Turn 5, with
 * nothing launched, they come home safe through Mars ascent, each Turn with nothing to answer.
 */
export const ascentSeed = (() => {
  const roundTripLanding: TurnPlan = {
    mission: crewLanding.mission && {
      ...crewLanding.mission,
      crew: {
        size: catalogue.crew.sizes[0]?.crew ?? 0,
        ...crewLanding.mission.crew,
        roundTrip: true,
      },
    },
  };
  for (let seed = 1; seed < 100_000; seed++) {
    const plant = richSimulation.workOutTurn(
      colossusBuilt(seed, richSimulation),
      fuelPlantToJezero,
    );
    if (plant.decisionPoint || plant.result.summary.failure) continue;
    const landed = richSimulation.workOutTurn(
      plant.result.program,
      roundTripLanding,
    );
    if (landed.decisionPoint || landed.result.summary.failure) continue;
    const there = landed.result.program;
    const way = richSimulation.readProgram(there).crew[0]?.waysHome[0];
    if (way?.reason !== null) continue;
    const home = richSimulation.workOutTurn(there, {
      mission: null,
      bringHome: way.key,
    });
    if (
      !home.decisionPoint &&
      home.result.summary.crewHome.length > 0 &&
      home.result.summary.ascentPropellantUsed.length > 0
    ) {
      return seed;
    }
  }
  throw new Error("No seed brings round-trip Crew home from the surface");
})();
