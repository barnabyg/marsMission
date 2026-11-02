import { describe, expect, it } from "vitest";
import { CatalogueError, parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, skipTurn } from "./testHelpers";

type ParticleSettings = Partial<
  ReturnType<typeof testCatalogueFiles>["hazards"]["solarParticleEvent"]
>;

/** The Test Catalogue with nothing able to fail but what a solar particle event does, and these settings for it. */
function withParticles(solarParticleEvent: ParticleSettings = {}) {
  const files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: 0,
      })),
      hazards: {
        ...files.hazards,
        solarParticleEvent: {
          ...files.hazards.solarParticleEvent,
          // As high as the 220-day Free-return allows, so most Missions on the Slow Trajectory meet one.
          chancePerDayInFlight: 1 / 220,
          ...solarParticleEvent,
        },
      },
    }),
  );
}

const fast: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    trajectoryId: "test-fast",
  },
};
const decisionId = "solar-particle-event";

/** A seed whose Mission meets a solar particle event on the Slow Trajectory. */
function seedWithEvent(simulation = withParticles()): number {
  for (let seed = 1; seed < 1000; seed++) {
    if (
      simulation.workOutTurn(simulation.startProgram(seed), sendOrbiter)
        .decisionPoint
    ) {
      return seed;
    }
  }
  throw new Error("No seed meets one");
}

describe("a solar particle event", () => {
  it("is more likely the longer the Duration, over many seeds", () => {
    const simulation = withParticles({ chancePerDayInFlight: 0.002 });
    const met = (plan: TurnPlan) =>
      Array.from({ length: 3000 }, (_, index) => index + 1).filter(
        (seed) =>
          simulation.workOutTurn(simulation.startProgram(seed), plan)
            .decisionPoint !== null,
      ).length / 3000;
    // Between the 1-day burn and arrival: 198 days on Slow and 118 on Fast, at 0.2% a day.
    expect(met(sendOrbiter)).toBeCloseTo(0.396, 1);
    expect(met(fast)).toBeCloseTo(0.236, 1);
    expect(met(sendOrbiter)).toBeGreaterThan(met(fast));
  });

  it("needs a Mission in flight", () => {
    const simulation = withParticles();
    for (let seed = 1; seed <= 50; seed++) {
      expect(
        simulation.workOutTurn(simulation.startProgram(seed), skipTurn)
          .decisionPoint,
      ).toBeNull();
    }
  });

  it("happens on the way, never before the Mission has left or after it arrives", () => {
    const simulation = withParticles({ chancePerDayInFlight: 0.004 });
    for (let seed = 1; seed <= 300; seed++) {
      const { decisionPoint } = simulation.workOutTurn(
        simulation.startProgram(seed),
        sendOrbiter,
      );
      if (!decisionPoint) continue;
      expect(decisionPoint.day).toBeGreaterThan(1);
      expect(decisionPoint.day).toBeLessThan(200);
    }
  });

  it("falls on the same day whichever Trajectory meets it", () => {
    const simulation = withParticles({ chancePerDayInFlight: 0.004 });
    for (let seed = 1; seed <= 300; seed++) {
      const program = simulation.startProgram(seed);
      const onFast = simulation.workOutTurn(program, fast).decisionPoint;
      if (!onFast) continue;
      expect(
        simulation.workOutTurn(program, sendOrbiter).decisionPoint?.day,
      ).toBe(onFast.day);
    }
  });

  it("is lost along with a Mission that fails before it", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === "test-burn" ? 1 : 0,
        })),
        hazards: {
          ...files.hazards,
          solarParticleEvent: {
            ...files.hazards.solarParticleEvent,
            chancePerDayInFlight: 1 / 220,
          },
        },
      }),
    );
    const { decisionPoint } = simulation.workOutTurn(
      simulation.startProgram(seedWithEvent()),
      sendOrbiter,
    );
    expect(decisionPoint).toBeNull();
  });

  it("stops the Turn at a Decision Point, with what each choice costs", () => {
    const simulation = withParticles({ damageChance: 0.08 });
    const { decisionPoint, timeline } = simulation.workOutTurn(
      simulation.startProgram(seedWithEvent()),
      sendOrbiter,
    );
    expect(decisionPoint).toMatchObject({
      id: decisionId,
      kind: "solarParticleEvent",
      assets: ["Test Orbiter"],
    });
    const [safeMode, carryOn] = decisionPoint?.choices ?? [];
    expect(safeMode).toMatchObject({ answer: "safeMode", riskBand: null });
    expect(safeMode?.description).toContain("10%");
    expect(carryOn).toMatchObject({ answer: "carryOn", riskBand: "~10%" });
    expect(carryOn?.description).toContain("50%");
    expect(carryOn?.description).toContain("30 Public Support");
    expect(timeline.decisionDay).toBe(decisionPoint?.day);
    expect(timeline.mission?.solarParticleEventDay).toBe(decisionPoint?.day);
    expect(timeline.mission?.assets[0]?.deliveredOnDay).toBeNull();
  });
});

describe("answering a solar particle event", () => {
  it("safe mode protects the Assets, each with less Service Life, in every view of the result", () => {
    const simulation = withParticles();
    const seed = seedWithEvent();
    const { summary, program, timeline } = simulation.runTurn(
      simulation.startProgram(seed),
      sendOrbiter,
      { [decisionId]: "safeMode" },
    );
    expect(summary.solarParticleEvent).toEqual({
      answer: "safeMode",
      outcome: "protected",
      assets: ["Test Orbiter"],
      serviceLifeLossPercent: 10,
    });
    // The shortest Service Life is 50,000 days.
    expect(program.operatingAssets[0]?.serviceLifeDays).toBe(45_000);
    expect(timeline.assetsAtMars[0]?.cutServiceLifeDays).toBe(45_000);
    expect(
      timeline.entries.some(
        (entry) => entry.kind === "hazard" && entry.title.includes("safe mode"),
      ),
    ).toBe(true);
    expect(summary.failure).toBeNull();
  });

  it("carrying on costs nothing if it isn't hit", () => {
    const simulation = withParticles({ damageChance: 0 });
    const { summary, program } = simulation.runTurn(
      simulation.startProgram(seedWithEvent()),
      sendOrbiter,
      { [decisionId]: "carryOn" },
    );
    expect(summary.solarParticleEvent).toMatchObject({
      outcome: "unharmed",
      serviceLifeLossPercent: 0,
    });
    expect(program.operatingAssets[0]?.serviceLifeDays).toBe(50_000);
  });

  it("carrying on and being hit shortens Service Life much further", () => {
    const simulation = withParticles({ damageChance: 1 });
    const { summary, program } = simulation.runTurn(
      simulation.startProgram(seedWithEvent()),
      sendOrbiter,
      { [decisionId]: "carryOn" },
    );
    expect(summary.solarParticleEvent).toMatchObject({
      outcome: "damaged",
      serviceLifeLossPercent: 50,
    });
    expect(program.operatingAssets[0]?.serviceLifeDays).toBe(25_000);
  });

  it("carrying on can lose the Mission's Assets on the way, which costs Public Support", () => {
    const simulation = withParticles({
      damageChance: 1,
      lossChanceIfDamaged: 1,
    });
    const start = simulation.startProgram(seedWithEvent());
    const { summary, program, timeline } = simulation.runTurn(
      start,
      sendOrbiter,
      { [decisionId]: "carryOn" },
    );
    const day = timeline.mission?.solarParticleEventDay;
    expect(summary.solarParticleEvent?.outcome).toBe("lost");
    expect(summary.failure).toEqual({
      missionEventName: "Solar particle event",
      hazard: true,
      assetsLost: ["Test Orbiter"],
      publicSupportLost: 30,
      returnedToEarth: false,
      refundMillions: 0,
    });
    expect(program.operatingAssets).toEqual([]);
    expect(summary.milestones).toEqual([]);
    expect(timeline.mission?.failedOnDay).toBe(day);
    expect(timeline.mission?.assets[0]?.lostOnDay).toBe(day);
    expect(
      timeline.entries.filter((entry) => entry.kind === "missionEvent"),
    ).toHaveLength(2);
  });

  it("doesn't re-roll anything else", () => {
    const simulation = withParticles({ damageChance: 0.5 });
    const start = simulation.startProgram(seedWithEvent());
    const answers = { [decisionId]: "carryOn" } as const;
    expect(simulation.runTurn(start, sendOrbiter, answers)).toEqual(
      simulation.runTurn(start, sendOrbiter, answers),
    );
  });
});

describe("the Catalogue's solar particle event", () => {
  const parseWith = (solarParticleEvent: ParticleSettings) => {
    const files = testCatalogueFiles();
    return () =>
      parseCatalogue({
        ...files,
        hazards: {
          ...files.hazards,
          solarParticleEvent: {
            ...files.hazards.solarParticleEvent,
            ...solarParticleEvent,
          },
        },
      });
  };

  it("refuses a chance so high that a longer Duration couldn't be more exposed", () => {
    expect(parseWith({ chancePerDayInFlight: 0.01 })).toThrow(
      /chancePerDayInFlight/,
    );
  });

  it("refuses damage that costs no more than safe mode", () => {
    expect(
      parseWith({
        safeModeServiceLifeLossPercent: 30,
        damageServiceLifeLossPercent: 30,
      }),
    ).toThrow(/damageServiceLifeLossPercent/);
  });

  it("refuses chances that can't be one", () => {
    expect(parseWith({ damageChance: 2 })).toThrow(CatalogueError);
    expect(parseWith({ lossChanceIfDamaged: -1 })).toThrow(CatalogueError);
  });
});
