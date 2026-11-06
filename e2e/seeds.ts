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
  playedBy = simulation,
): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const progress = playedBy.workOutTurn(playedBy.startProgram(seed), plan);
    if (progress.decisionPoint) continue;
    const { summary } = progress.result;
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

/** A seed whose first Mission loses its lander before it has left Earth. */
export const landerLostAtLaunchSeed = seedWhere("Launch", firstLanding);

/** A seed whose first Mission loses its lander on the way to Mars. */
export const landerLostOnTheWaySeed = seedWhere(
  "Mars transfer burn",
  firstLanding,
);

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

/** A seed where an orbiter and lander launched together both arrive. */
export const orbiterAndLanderSeed = seedWhere(null, orbiterAndLander);

/** A seed whose first Mission lands the Pinpoint Lander, which starts unproven, at the first known Landing Site. */
export const pinpointLandingSeed = seedWhere(null, {
  mission: {
    launchVehicleId: catalogue.launchVehicles[0]?.id ?? "",
    assetIds: ["pinpoint-lander"],
    landingSiteId: "jezero-crater",
  },
});

/** A seed whose first Mission lands a rover alone at the first known Landing Site. */
export const roverSeed = seedWhere(null, {
  mission: {
    launchVehicleId: catalogue.launchVehicles[0]?.id ?? "",
    assetIds: ["trailblazer-rover"],
    landingSiteId: "jezero-crater",
  },
});

/** Enough to launch a lander and a rover on the first Turn, which a real Program can't afford until later. */
export const landerAndRoverMoney = 3000;

const wealthySimulation = createSimulation(
  parseCatalogue({
    ...realCatalogueFiles(),
    program: {
      ...catalogue.program,
      startingMoneyMillions: landerAndRoverMoney,
    },
  }),
);

/** What the tests launch to land a lander and a rover together. */
const landerAndRover: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-heavy",
    assetIds: ["prospector-lander", "trailblazer-rover"],
    landingSiteId: "jezero-crater",
  },
};

/** A seed where a lander and a rover launched together both land. */
export const landerAndRoverSeed = seedWhere(
  null,
  landerAndRover,
  wealthySimulation,
);

/** A seed where a lander and a relay orbiter launched together both arrive, with the same money as a lander and a rover. */
export const relayAndLanderSeed = seedWhere(
  null,
  {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["prospector-lander", "courier-relay-orbiter"],
      landingSiteId: "jezero-crater",
    },
  },
  wealthySimulation,
);

/** A seed where a lander and a rover launched together crash. */
export const landerAndRoverCrashSeed = seedWhere(
  "Entry/descent/landing",
  landerAndRover,
  wealthySimulation,
);

/** A seed where the first orbiter arrives, and what happens to it during the next Turn is as asked. */
function seedWhereOrbiter(nextTurn: (summary: TurnSummary) => boolean): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const first = simulation.workOutTurn(
      simulation.startProgram(seed),
      firstPlan,
    );
    if (first.decisionPoint || first.result.summary.failure) continue;
    const second = simulation.workOutTurn(first.result.program, {
      mission: null,
    });
    if (!second.decisionPoint && nextTurn(second.result.summary)) return seed;
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

/** A seed whose first Mission reaches this Decision Point, and using the Contingency works or fails as asked. */
function seedWhereUsing(
  plan: TurnPlan,
  decisionId: string,
  rescued: boolean,
  playedBy = simulation,
): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const program = playedBy.startProgram(seed);
    if (playedBy.workOutTurn(program, plan).decisionPoint?.id !== decisionId) {
      continue;
    }
    const progress = playedBy.workOutTurn(program, plan, {
      [decisionId]: "use",
    });
    // Another Decision Point later in the Turn would get in the way of what the tests look at.
    if (progress.decisionPoint) continue;
    if (progress.result.summary.contingencies[0]?.rescued === rescued) {
      return seed;
    }
  }
  throw new Error(`No seed gives ${decisionId} that outcome`);
}

const orbiterWithReserveFuel: TurnPlan = {
  mission: { ...firstPlan.mission, contingencyIds: ["reserve-fuel"] },
};

/** A seed whose first orbiter fails Mars orbit insertion, and Reserve fuel saves it. */
export const orbitInsertionRescuedSeed = seedWhereUsing(
  orbiterWithReserveFuel,
  "contingency:mars-orbit-insertion",
  true,
);

/** A seed whose first orbiter fails Mars orbit insertion, and Reserve fuel can't save it. */
export const orbitInsertionRescueFailsSeed = seedWhereUsing(
  orbiterWithReserveFuel,
  "contingency:mars-orbit-insertion",
  false,
);

/** A seed whose first lander comes down too fast, and Retro thrusters save it. */
export const landingRescuedSeed = seedWhereUsing(
  {
    mission: {
      launchVehicleId: catalogue.launchVehicles[0]?.id ?? "",
      assetIds: ["prospector-lander"],
      landingSiteId: "jezero-crater",
      contingencyIds: ["retro-thrusters"],
    },
  },
  "contingency:entry-descent-landing",
  true,
);

/**
 * A seed whose first lander lands at the first known Landing Site with nothing to answer on the way, and a dust storm
 * over it then raises a Decision Point on Turn 2, where carrying on loses the lander or doesn't, as asked.
 */
function seedWithStormOnTurn2(lostIfCarryingOn: boolean): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const first = simulation.workOutTurn(
      simulation.startProgram(seed),
      firstLanding,
    );
    if (first.decisionPoint || first.result.summary.failure) continue;
    const { program } = first.result;
    const skip = { mission: null };
    const second = simulation.workOutTurn(program, skip);
    if (second.decisionPoint?.id !== "dust-storm:jezero-crater") continue;
    const carriedOn = simulation.workOutTurn(program, skip, {
      "dust-storm:jezero-crater": "carryOn",
    });
    if (
      !carriedOn.decisionPoint &&
      carriedOn.result.summary.dustStorms[0]?.assetsFailed.length ===
        (lostIfCarryingOn ? 1 : 0)
    ) {
      return seed;
    }
  }
  throw new Error("No seed gives that dust storm");
}

/** A seed whose first lander lands at the first known Landing Site, and Turn 2 then has nothing to answer there. */
export const calmSecondTurnSeed = (() => {
  for (let seed = 1; seed < 100_000; seed++) {
    const first = simulation.workOutTurn(
      simulation.startProgram(seed),
      firstLanding,
    );
    if (first.decisionPoint || first.result.summary.failure) continue;
    const second = simulation.workOutTurn(first.result.program, {
      mission: null,
    });
    if (!second.decisionPoint) return seed;
  }
  throw new Error("No seed gives a calm second Turn");
})();

/** A seed with a dust storm on Turn 2 that a lander comes through if it carries on. */
export const dustStormSeed = seedWithStormOnTurn2(false);

/** A seed with a dust storm on Turn 2 that a lander fails in if it carries on. */
export const dustStormLossSeed = seedWithStormOnTurn2(true);

/** A seed whose first orbiter meets a solar particle event, where carrying on gives this outcome and nothing else stops the Turn. */
function seedWithParticles(carryingOn: "unharmed" | "lost"): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const program = simulation.startProgram(seed);
    const met = simulation.workOutTurn(program, firstPlan);
    if (met.decisionPoint?.id !== "solar-particle-event") continue;
    const answered = (answer: "safeMode" | "carryOn") =>
      simulation.workOutTurn(program, firstPlan, {
        "solar-particle-event": answer,
      });
    const carriedOn = answered("carryOn");
    if (answered("safeMode").decisionPoint || carriedOn.decisionPoint) {
      continue;
    }
    if (carriedOn.result.summary.solarParticleEvent?.outcome === carryingOn) {
      return seed;
    }
  }
  throw new Error("No seed gives that solar particle event");
}

/** A seed whose first orbiter meets a solar particle event and comes through it whatever the answer. */
export const solarParticleEventSeed = seedWithParticles("unharmed");

/** A seed whose first orbiter meets a solar particle event, which loses it if it carries on. */
export const solarParticleLossSeed = seedWithParticles("lost");

/**
 * A seed whose first lander reaches the first known Landing Site during a dust storm, and holding off lands it safely
 * after the storm with nothing else to answer that Turn.
 */
export const holdOffSeed = (() => {
  for (let seed = 1; seed < 100_000; seed++) {
    const program = simulation.startProgram(seed);
    const met = simulation.workOutTurn(program, firstLanding);
    if (met.decisionPoint?.id !== "go-no-go:entry-descent-landing") continue;
    const held = simulation.workOutTurn(program, firstLanding, {
      "go-no-go:entry-descent-landing": "holdOff",
    });
    if (!held.decisionPoint && !held.result.summary.failure) return seed;
  }
  throw new Error("No seed gives a landing to hold off");
})();

/** A seed whose first orbiter fails Mars orbit insertion on a Free-return Trajectory. */
export const freeReturnSeed = seedWhere("Mars orbit insertion", {
  mission: { ...firstPlan.mission, trajectoryId: "free-return" },
});

/** A seed whose first Mission succeeds. */
export const successSeed = seedWhere(null);

/** A seed whose first Mission fails at the named Mission Event. */
export const seedFailingAt = (missionEventName: string) =>
  seedWhere(missionEventName);

/** A seed whose first Mission lands the fuel plant, which starts unproven, at the first known Landing Site, with nothing to answer. */
export const fuelPlantSeed = seedWhere(null, {
  mission: {
    launchVehicleId: "meridian-heavy",
    assetIds: ["wellspring-fuel-plant"],
    landingSiteId: "jezero-crater",
  },
});

/** A Mission on the Meridian Medium landing this Asset at the first known Landing Site, as Planning Mode offers it. */
const landingAtJezero = (assetId: string): TurnPlan => ({
  mission: {
    launchVehicleId: "meridian-medium",
    assetIds: [assetId],
    landingSiteId: "jezero-crater",
  },
});

/**
 * A seed on which a rover lands at the first known Landing Site, and a Mars lab lands beside it on the next Turn and
 * raises its Research Grant, with nothing to answer on either Turn.
 */
export const labSeed = ((): number => {
  for (let seed = 1; seed < 100_000; seed++) {
    const first = simulation.workOutTurn(
      simulation.startProgram(seed),
      landingAtJezero("trailblazer-rover"),
    );
    if (first.decisionPoint || first.result.summary.failure) continue;
    const second = simulation.workOutTurn(
      first.result.program,
      landingAtJezero("curie-lab"),
    );
    if (second.decisionPoint || second.result.summary.failure) continue;
    const raised = second.result.summary.researchGrants.some(
      ({ name, benefit }) => name === "Trailblazer Rover" && benefit,
    );
    if (raised) return seed;
  }
  throw new Error("No seed lands a rover and then a Mars lab beside it");
})();

/** Enough for a rover, then an ascent vehicle and an Earth return orbiter on the Meridian Heavy. Money changes no roll. */
export const sampleReturnMoney = 8000;

/**
 * The Turns of sending samples home, as Planning Mode plays them: a rover on Sample caching lands at Jezero Crater, the
 * Kestrel Lifter lands beside it and the Albatross Orbiter goes to Mars orbit together on the next Turn, and on the
 * third the samples go home, while both still have Service Life left on their shortest.
 */
const sampleReturnPlans: TurnPlan[] = [
  {
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["trailblazer-rover"],
      landingSiteId: "jezero-crater",
      assetChoices: { "trailblazer-rover": { activityId: "sample-caching" } },
    },
  },
  {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["kestrel-ascent-vehicle", "albatross-return-orbiter"],
      landingSiteId: "jezero-crater",
    },
  },
  { mission: null, bringHome: "samples:jezero-crater" },
];

/** A seed on which those three Turns play with nothing to answer, nothing lost, and the samples reach Earth. */
export const sampleReturnSeed = ((): number => {
  const files = realCatalogueFiles();
  const rich = createSimulation(
    parseCatalogue({
      ...files,
      program: { ...files.program, startingMoneyMillions: sampleReturnMoney },
    }),
  );
  for (let seed = 1; seed < 100_000; seed++) {
    let program = rich.startProgram(seed);
    let summary: TurnSummary | null = null;
    for (const plan of sampleReturnPlans) {
      // Something lost on the way leaves a later Turn's plan with nothing to fly.
      if (rich.validatePlan(program, plan).problems.length > 0) break;
      const progress = rich.workOutTurn(program, plan);
      if (progress.decisionPoint) break;
      ({ program, summary } = progress.result);
      if (summary.failure || summary.assetsFailed.length > 0) break;
      if (!plan.bringHome) summary = null;
    }
    if (summary?.samplesHome.length === 1) return seed;
  }
  throw new Error("No seed caches samples and sends them home");
})();
