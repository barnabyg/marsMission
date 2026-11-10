import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Program, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, skipTurn, withFailures } from "./testHelpers";

const orbiterAndLander: TurnPlan = {
  mission: {
    launchVehicleId: "test-heavy",
    assetIds: ["test-orbiter", "test-lander"],
    landingSiteId: "alpha-plain",
  },
};

/** Runs Turns one after another, each with this plan. */
function playTurns(
  simulation: ReturnType<typeof withFailures>["simulation"],
  program: Program,
  turns: number,
  plan: TurnPlan = skipTurn,
): Program {
  let played = program;
  for (let turn = 0; turn < turns; turn += 1) {
    played = {
      ...simulation.runTurn(played, plan).program,
      publicSupport: 100,
    };
  }
  return played;
}

describe("the Bailout", () => {
  it("is offered after a lost Mission for what it cost, repaid in ten equal Turns", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const { summary, program: after } = simulation.runTurn(
      program,
      sendOrbiter,
    );
    expect(summary.missionCostMillions).toBe(500);
    expect(summary.bailoutOffer).toEqual({
      millions: 500,
      repaymentMillions: 50,
      repaymentTurns: 10,
    });
    expect(simulation.readProgram(after).bailout).toEqual({
      kind: "offered",
      millions: 500,
      repaymentMillions: 50,
      repaymentTurns: 10,
    });
  });

  it("isn't offered after a Mission that delivered everything, or a Turn with none", () => {
    const { simulation, program } = withFailures([]);
    const flown = simulation.runTurn(program, sendOrbiter);
    expect(flown.summary.bailoutOffer).toBeNull();
    expect(simulation.readProgram(flown.program).bailout).toEqual({
      kind: "available",
      repaymentTurns: 10,
    });
    expect(
      simulation.runTurn(program, skipTurn).summary.bailoutOffer,
    ).toBeNull();
  });

  it("refunds only the Assets lost when the Mission delivered some", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const { summary } = simulation.runTurn(program, orbiterAndLander);
    expect(summary.failure?.assetsLost).toEqual(["Test Lander"]);
    expect(summary.bailoutOffer?.millions).toBe(300);
  });

  it("takes off what a Free-return refunded", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary } = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        trajectoryId: "test-free-return",
      },
    });
    expect(summary.failure?.returnedToEarth).toBe(true);
    expect(summary.failure?.refundMillions).toBeGreaterThan(0);
    expect(summary.bailoutOffer?.millions).toBe(
      summary.missionCostMillions - (summary.failure?.refundMillions ?? 0),
    );
  });

  it("pays the refund when taken, and takes a repayment as each of the next ten Turns ends", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const lost = simulation.runTurn(program, sendOrbiter).program;
    const taken = simulation.takeBailout(lost);
    expect(taken.moneyMillions).toBe(lost.moneyMillions + 500);
    expect(simulation.readProgram(taken).bailout).toEqual({
      kind: "taken",
      onTurn: 1,
      millions: 500,
      dueThisTurnMillions: 50,
      owedMillions: 500,
      turnsLeft: 10,
    });

    const next = simulation.runTurn({ ...taken, publicSupport: 100 }, skipTurn);
    expect(next.summary.bailoutRepaidMillions).toBe(50);
    expect(next.summary.moneyEndMillions).toBe(taken.moneyMillions - 50);

    const repaid = playTurns(simulation, taken, 10);
    expect(repaid.moneyMillions).toBe(taken.moneyMillions - 500);
    expect(simulation.readProgram(repaid).bailout).toMatchObject({
      kind: "taken",
      dueThisTurnMillions: 0,
      owedMillions: 0,
      turnsLeft: 0,
    });
    expect(
      simulation.runTurn({ ...repaid, publicSupport: 100 }, skipTurn).summary
        .bailoutRepaidMillions,
    ).toBe(0);
  });

  it("can be taken only once, and only while it is on offer", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    expect(() => simulation.takeBailout(program)).toThrow(
      "The Bailout isn't on offer.",
    );
    const taken = simulation.takeBailout(
      simulation.runTurn(program, sendOrbiter).program,
    );
    expect(() => simulation.takeBailout(taken)).toThrow();
    const lostAgain = simulation.runTurn(
      { ...taken, publicSupport: 100 },
      sendOrbiter,
    );
    expect(lostAgain.summary.bailoutOffer).toBeNull();
  });

  it("lapses if the next Turn is played without taking it, and is offered again for a later loss", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const lost = simulation.runTurn(program, sendOrbiter).program;
    const skipped = simulation.runTurn(
      { ...lost, publicSupport: 100 },
      skipTurn,
    );
    expect(skipped.summary.bailoutOffer).toBeNull();
    expect(() => simulation.takeBailout(skipped.program)).toThrow();
    const lostAgain = simulation.runTurn(
      { ...skipped.program, moneyMillions: 1000 },
      sendOrbiter,
    );
    expect(lostAgain.summary.bailoutOffer?.millions).toBe(500);
  });

  it("isn't offered when the Turn cancels the Program", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const { summary } = simulation.runTurn(
      { ...program, publicSupport: 50 },
      sendOrbiter,
    );
    expect(summary.cancellationReason).not.toBeNull();
    expect(summary.bailoutOffer).toBeNull();
  });

  it("can take Money below zero, which stops the Program buying a Mission until it recovers", () => {
    const { simulation, program } = withFailures(["test-launch"], {
      startingMoneyMillions: 500,
    });
    const taken = simulation.takeBailout(
      simulation.runTurn(program, sendOrbiter).program,
    );
    expect(taken.moneyMillions).toBe(500);
    const broke = simulation.runTurn(
      { ...taken, publicSupport: 100 },
      sendOrbiter,
    ).program;
    expect(broke.moneyMillions).toBe(-50);
    expect(simulation.validatePlan(broke, sendOrbiter).problems).toEqual([
      "This Mission costs $500M, but the Program only has -$50M.",
    ]);
    expect(simulation.validatePlan(broke, skipTurn).problems).toEqual([]);
  });
});

describe("Upkeep while a Bailout is repaid", () => {
  function withUpkeep() {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        assets: files.assets.map((asset) =>
          asset.id === "test-orbiter"
            ? { ...asset, upkeepMillionsPerTurn: 30 }
            : asset,
        ),
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 0,
        })),
      }),
    );
    const atMars = simulation.runTurn(
      simulation.startProgram(42),
      sendOrbiter,
    ).program;
    return { simulation, atMars };
  }

  it("can take Money below zero by up to what is still owed", () => {
    const { simulation, atMars } = withUpkeep();
    const owing = (moneyMillions: number, repaymentsMillions: number[]) =>
      simulation.validatePlan(
        {
          ...atMars,
          moneyMillions,
          bailout: {
            kind: "taken",
            onTurn: 1,
            millions: 500,
            repaymentsMillions,
          },
        },
        skipTurn,
      ).problems;
    expect(owing(-10, [50])).toEqual([]);
    expect(owing(-20, [50])).toEqual([]);
    expect(owing(-20, [25, 25])).toEqual([]);
    expect(owing(-30, [50])).toEqual([
      "Upkeep of the Assets at Mars costs $30M, but the Program only has -$30M. End some of their missions.",
    ]);
    expect(owing(-30, [])).toHaveLength(1);
  });
});

describe("saving the Bailout", () => {
  it("keeps an offer and a Bailout being repaid", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const lost = simulation.runTurn(program, sendOrbiter).program;
    const restore = (saved: Program) =>
      simulation.restoreProgram(
        JSON.parse(JSON.stringify(simulation.saveProgram(saved))),
      );
    expect(restore(lost).bailout).toEqual(lost.bailout);
    const taken = simulation.takeBailout(lost);
    const broke = { ...taken, moneyMillions: -120 };
    expect(restore(broke)).toEqual(broke);
  });

  it("makes it available in a save from before it", () => {
    const { simulation, program } = withFailures([]);
    const before: Partial<Program> = { ...program };
    delete before.bailout;
    const restored = simulation.restoreProgram({
      formatVersion: 14,
      program: before,
    });
    expect(restored.bailout).toEqual({ kind: "available" });
  });
});
