import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { safeLandingFiles, skipTurn } from "./testHelpers";

const paid = "test-paid-research";
const unpaid = "test-research";

/** The files with every Asset able to do paid research, at this Research Grant rate if one is given. */
function withPaidResearch(
  grantMillionsPerScience?: number,
  files: CatalogueFiles = safeLandingFiles(),
): Simulation {
  return createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: [...asset.activities, paid],
      })),
      researchKinds: files.researchKinds.map((kind) =>
        kind.id === "test-paid" && grantMillionsPerScience !== undefined
          ? { ...kind, grantMillionsPerScience }
          : kind,
      ),
    }),
  );
}

const orbiterDoing = (activityId: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    assetChoices: { "test-orbiter": { activityId } },
  },
});

/** Both Assets on one Mission, each doing its own Activity. */
const bothDoing = (
  orbiterActivity: string,
  landerActivity: string,
): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter", "test-lander"],
    landingSiteId: "alpha-plain",
    assetChoices: {
      "test-orbiter": { activityId: orbiterActivity },
      "test-lander": { activityId: landerActivity },
    },
  },
});

/** A Program whose orbiter has been doing the Activity since last Turn, so the next Turn is a whole one in service. */
function operating(simulation: Simulation, activityId: string): Program {
  return simulation.runTurn(
    simulation.startProgram(42),
    orbiterDoing(activityId),
  ).program;
}

describe("paying a Research Grant", () => {
  it("pays for a whole Turn's Ongoing Research, and the next Turn starts with the money", () => {
    const simulation = withPaidResearch();
    const program = operating(simulation, paid);
    const before = simulation.readProgram(program).moneyMillions;
    const { summary, program: after } = simulation.runTurn(program, skipTurn);
    // 78 Science at $0.5M each.
    expect(summary.researchGrants).toEqual([
      { name: "Test Orbiter", millions: 39 },
    ]);
    expect(summary.researchGrantMillions).toBe(39);
    expect(summary.moneyStartMillions).toBe(before);
    expect(summary.moneyEndMillions).toBe(before + 39);
    expect(simulation.readProgram(after).moneyMillions).toBe(before + 39);
  });

  it("pays for the Science earned in a part of a Turn, separately from Funding Threshold payouts", () => {
    const simulation = withPaidResearch();
    const { summary, program } = simulation.runTurn(
      simulation.startProgram(42),
      orbiterDoing(paid),
    );
    // 580 of the Turn's 780 days earn 58 Science, at $0.5M each.
    expect(summary.researchGrants).toEqual([
      { name: "Test Orbiter", millions: 29 },
    ]);
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 300, payoutMillions: 1000 },
    ]);
    // $2000M less the $500M Mission, plus the payout and the Research Grant.
    expect(summary.moneyEndMillions).toBe(2529);
    expect(simulation.readProgram(program).moneyMillions).toBe(2529);
  });

  it("pays nothing for research of a kind with a zero rate", () => {
    const simulation = withPaidResearch();
    const { summary } = simulation.runTurn(
      operating(simulation, unpaid),
      skipTurn,
    );
    expect(summary.ongoingResearch[0]?.science).toBe(78);
    expect(summary.researchGrants).toEqual([]);
    expect(summary.researchGrantMillions).toBe(0);
    expect(summary.moneyEndMillions).toBe(summary.moneyStartMillions);
  });

  it("pays each Asset by the rate of what it's doing", () => {
    const simulation = withPaidResearch();
    const { summary } = simulation.runTurn(
      simulation.startProgram(42),
      bothDoing(unpaid, paid),
    );
    expect(summary.ongoingResearch).toHaveLength(2);
    expect(summary.researchGrants).toEqual([
      { name: "Test Lander", millions: 29 },
    ]);
  });

  it("pays nothing for Science from Milestones and first landings", () => {
    const simulation = withPaidResearch();
    const { summary } = simulation.runTurn(
      simulation.startProgram(42),
      bothDoing("test-nothing", "test-nothing"),
    );
    // The first orbiter's 100, the first landing Milestone's 40 and Alpha Plain's 50.
    expect(summary.scienceGained).toBe(190);
    expect(summary.researchGrants).toEqual([]);
    expect(summary.researchGrantMillions).toBe(0);
  });

  it("pays only for the Ongoing Research when Milestones and a first landing earn Science in the same Turn", () => {
    const simulation = withPaidResearch();
    const { summary } = simulation.runTurn(
      simulation.startProgram(42),
      bothDoing("test-nothing", paid),
    );
    // The lander lands on day 205, so 575 of the 780 days earn 58 Science, on top of the 190.
    expect(summary.scienceGained).toBe(248);
    expect(summary.researchGrantMillions).toBe(29);
  });

  it("pays nothing for an Asset lost on the Mission", () => {
    const files = safeLandingFiles();
    const simulation = withPaidResearch(undefined, {
      ...files,
      missionEvents: files.missionEvents.map((event) =>
        event.id === "test-burn" ? { ...event, failureProbability: 1 } : event,
      ),
    });
    const { summary } = simulation.runTurn(
      simulation.startProgram(42),
      orbiterDoing(paid),
    );
    expect(summary.failure?.assetsLost).toEqual(["Test Orbiter"]);
    expect(summary.researchGrants).toEqual([]);
  });

  it("rounds to whole millions for each Asset, not for the total", () => {
    const simulation = withPaidResearch(0.25);
    const { program } = simulation.runTurn(
      simulation.startProgram(42),
      bothDoing(paid, paid),
    );
    const { summary } = simulation.runTurn(program, skipTurn);
    // 78 Science at $0.25M is $19.5M, which rounds up for each. Rounding the total would pay $39M.
    expect(summary.researchGrants).toEqual([
      { name: "Test Orbiter", millions: 20 },
      { name: "Test Lander", millions: 20 },
    ]);
    expect(summary.researchGrantMillions).toBe(40);
    expect(summary.moneyEndMillions).toBe(summary.moneyStartMillions + 40);
  });

  it.each([
    ["rounds $0.78M up to $1M", 0.01, 1],
    ["pays and lists nothing for $0.39M", 0.005, 0],
  ])("%s", (_, rate, millions) => {
    const simulation = withPaidResearch(rate);
    const { summary } = simulation.runTurn(
      operating(simulation, paid),
      skipTurn,
    );
    expect(summary.ongoingResearch[0]?.science).toBe(78);
    expect(summary.researchGrantMillions).toBe(millions);
    expect(summary.researchGrants).toEqual(
      millions > 0 ? [{ name: "Test Orbiter", millions }] : [],
    );
    expect(summary.moneyEndMillions).toBe(
      summary.moneyStartMillions + millions,
    );
  });

  it("includes the grant in the money of a Program cancelled at the end of the Turn", () => {
    const simulation = withPaidResearch();
    let program = operating(simulation, paid);
    for (let turn = 0; turn < 50; turn++) {
      const { summary, program: next } = simulation.runTurn(program, skipTurn);
      program = next;
      if (summary.cancellationReason === null) continue;
      expect(summary.researchGrantMillions).toBe(39);
      expect(summary.moneyEndMillions).toBe(summary.moneyStartMillions + 39);
      const view = simulation.readProgram(program);
      expect(view.status.kind).toBe("cancelled");
      expect(view.moneyMillions).toBe(summary.moneyEndMillions);
      return;
    }
    throw new Error("Expected the Program to be cancelled");
  });

  it("needs nothing new in a save, because the money is already in the Program", () => {
    const simulation = withPaidResearch();
    const { program } = simulation.runTurn(
      operating(simulation, paid),
      skipTurn,
    );
    expect(simulation.restoreProgram(simulation.saveProgram(program))).toEqual(
      program,
    );
  });
});

describe("what Planning Mode is told about Research Grants", () => {
  const grantsFor = (simulation: Simulation) =>
    Object.fromEntries(
      simulation
        .previewAssets({
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
        })[0]
        ?.activities.map(({ id, earnsPerTurn }) => [
          id,
          earnsPerTurn?.researchGrantMillions ?? null,
        ]) ?? [],
    );

  it("gives what a whole Turn of each research Activity pays", () => {
    expect(grantsFor(withPaidResearch())).toEqual({
      "test-survey": null,
      "test-nothing": null,
      [unpaid]: 0,
      [paid]: 39,
    });
  });

  it("gives zero for a rate that rounds to nothing, as a whole Turn would be paid", () => {
    expect(grantsFor(withPaidResearch(0.005))[paid]).toBe(0);
  });

  it("gives it for an operating Asset too", () => {
    const simulation = withPaidResearch();
    const [orbiter] = simulation.readProgram(
      operating(simulation, paid),
    ).operatingAssets;
    expect(
      orbiter?.activities.find(({ id }) => id === paid)?.earnsPerTurn,
    ).toEqual({ science: 78, publicSupport: 0, researchGrantMillions: 39 });
  });
});
