import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";

/** The Test Catalogue with nothing able to fail but what a solar particle event does, which comes to most Missions. */
function withParticles({ damageChance = 0, lossChanceIfDamaged = 0 } = {}) {
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
          chancePerDayInFlight: 1 / 220,
          damageChance,
          lossChanceIfDamaged,
        },
      },
    }),
  );
}

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };
const sendShielded: TurnPlan = {
  mission: {
    ...crewMission,
    crew: { size: 2, protectionId: "test-shielding" },
  },
};
const decisionId = "solar-particle-event";

/** A Program whose Crewed Mission meets a solar particle event on the Slow Trajectory. */
function programWithEvent(simulation: ReturnType<typeof withParticles>) {
  for (let seed = 1; seed < 1000; seed++) {
    const program = simulation.startProgram(seed);
    if (simulation.workOutTurn(program, sendCrew).decisionPoint) return program;
  }
  throw new Error("No seed meets one");
}

/** What the solar particle event cost Ann Able in Health, if anything. */
const particleHarm = (
  healthLost: { name: string; lost: { cause: string; health: number }[] }[],
) =>
  healthLost
    .find(({ name }) => name === "Ann Able")
    ?.lost.find(({ cause }) => cause === "solarParticleEvent")?.health;

describe("a solar particle event with Crew aboard", () => {
  it("weighs the Crew's Health at its Decision Point, which Protection lessens", () => {
    const simulation = withParticles();
    const program = programWithEvent(simulation);
    const choices = (plan: TurnPlan) =>
      simulation
        .workOutTurn(program, plan)
        .decisionPoint?.choices.map(({ description }) => description);
    expect(choices(sendCrew)).toEqual([
      "Safe mode protects Ann Able, Ben Baker, but costs each Crew member 10 Health.",
      "No cost if all goes well. If the radiation hits, each Crew member loses 40 Health, and there's a chance of losing the Mission, which costs 30 Public Support. Losing the Crew costs 40 Public Support more.",
    ]);
    expect(choices(sendShielded)).toEqual([
      "Safe mode protects Ann Able, Ben Baker, but costs each Crew member 5 Health.",
      "No cost if all goes well. If the radiation hits, each Crew member loses 20 Health, and there's a chance of losing the Mission, which costs 30 Public Support. Losing the Crew costs 40 Public Support more.",
    ]);
  });

  it("costs some Health in safe mode, and less with Protection", () => {
    const simulation = withParticles();
    const program = programWithEvent(simulation);
    const safeMode = { [decisionId]: "safeMode" } as const;
    const { summary, timeline } = simulation.runTurn(
      program,
      sendCrew,
      safeMode,
    );
    expect(particleHarm(summary.healthLost)).toBe(10);
    expect(summary.solarParticleEvent).toMatchObject({
      outcome: "protected",
      crew: ["Ann Able", "Ben Baker"],
      crewHealthLoss: 10,
    });
    expect(
      timeline.entries.find(({ title }) => title.endsWith("safe mode"))
        ?.description,
    ).toBe(
      "Safe mode protected Ann Able, Ben Baker, at a cost of 10 Health for each Crew member.",
    );
    const shielded = simulation.runTurn(program, sendShielded, safeMode);
    expect(particleHarm(shielded.summary.healthLost)).toBe(5);
    // Half of 20 on the way, 29 at Mars and the 10 safe mode would have cost.
    expect(shielded.summary.healthLost[0]?.savedByProtection).toBe(10 + 15 + 5);
  });

  it("costs a large loss of Health if the Crew carry on and the radiation hits, and less with Protection", () => {
    const simulation = withParticles({ damageChance: 1 });
    const program = programWithEvent(simulation);
    const carryOn = { [decisionId]: "carryOn" } as const;
    const { summary } = simulation.runTurn(program, sendCrew, carryOn);
    expect(particleHarm(summary.healthLost)).toBe(40);
    expect(summary.solarParticleEvent).toMatchObject({
      outcome: "damaged",
      crewHealthLoss: 40,
    });
    expect(
      particleHarm(
        simulation.runTurn(program, sendShielded, carryOn).summary.healthLost,
      ),
    ).toBe(20);
  });

  it("costs nothing if the Crew carry on and the radiation passes", () => {
    const simulation = withParticles();
    const program = programWithEvent(simulation);
    const { summary } = simulation.runTurn(program, sendCrew, {
      [decisionId]: "carryOn",
    });
    expect(particleHarm(summary.healthLost)).toBeUndefined();
    expect(summary.solarParticleEvent).toMatchObject({
      outcome: "unharmed",
      crewHealthLoss: 0,
    });
  });

  it("loses the Crew to it if it loses the Mission", () => {
    const simulation = withParticles({
      damageChance: 1,
      lossChanceIfDamaged: 1,
    });
    const { summary, program } = simulation.runTurn(
      programWithEvent(simulation),
      sendShielded,
      { [decisionId]: "carryOn" },
    );
    expect(summary.crewLost.map(({ names, cause }) => [names, cause])).toEqual([
      [["Ann Able", "Ben Baker"], "solarParticleEvent"],
    ]);
    expect(particleHarm(summary.healthLost)).toBeUndefined();
    expect(simulation.readProgram(program).crew).toEqual([]);
  });
});
