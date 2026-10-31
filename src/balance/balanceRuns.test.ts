import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type ProgramView,
  type TurnSummary,
} from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";
import { invalidStates } from "./invalidStates";
import { planningTools, playProgram } from "./playProgram";
import { balanceReport } from "./report";
import { strategies, type Strategy } from "./strategies";

const files = realCatalogueFiles();
const simulationOf = (catalogueFiles: CatalogueFiles) =>
  createSimulation(parseCatalogue(catalogueFiles));
const real = simulationOf(files);
const seeds = Array.from({ length: 20 }, (_, index) => index + 1);
const turns = 20;
const launchNothing: Strategy = {
  name: "test: launch nothing",
  description: "Never launches.",
  plan: () => ({ mission: null }),
};
const strategyCases = strategies.map(
  (strategy) => [strategy.name, strategy] as const,
);

/** With nothing able to fail, so that a test can work out what must happen. */
const certain: CatalogueFiles = {
  ...files,
  assets: files.assets.map((asset) => ({
    ...asset,
    failureChancePerTurn: 0,
  })),
  missionEvents: files.missionEvents.map((event) => ({
    ...event,
    failureProbability: 0,
  })),
};

describe("every strategy on the real data files", () => {
  it.each(strategyCases)(
    "%s only submits valid plans and leaves no invalid state",
    (_, strategy) => {
      for (const seed of seeds) {
        // playProgram throws on an invalid plan or state.
        const played = playProgram(real, strategy, seed, turns);
        expect(played.turns.length).toBeGreaterThan(0);
        expect(played.turns.length).toBeLessThanOrEqual(turns);
        const reached = played.turns.flatMap(
          ({ thresholdsReached }) => thresholdsReached,
        );
        expect(new Set(reached).size).toBe(reached.length);
      }
    },
  );

  it.each(strategyCases)(
    "%s copes with having no money to launch anything",
    (_, strategy) => {
      const broke = simulationOf({
        ...files,
        program: { ...files.program, startingMoneyMillions: 0 },
      });
      const played = playProgram(broke, strategy, 1, turns);
      expect(played.turns.every(({ launched }) => !launched)).toBe(true);
    },
  );

  it.each(strategyCases)(
    "%s copes with only one kind of Asset on offer",
    (_, strategy) => {
      const offered = simulationOf({
        ...files,
        assets: files.assets.filter(({ kind }) => kind === "lander"),
        milestones: files.milestones.filter(
          ({ trigger }) =>
            !("assetKindArrives" in trigger) ||
            trigger.assetKindArrives === "lander",
        ),
      });
      expect(
        playProgram(offered, strategy, 1, turns).turns.length,
      ).toBeGreaterThan(0);
    },
  );

  it.each(strategyCases)(
    "%s copes with operating an Asset that is no longer offered",
    (_, strategy) => {
      const { program } = real.runTurn(real.startProgram(1), {
        mission: {
          launchVehicleId: "meridian-medium",
          assetIds: ["pathfinder-orbiter"],
        },
      });
      const withoutIt = simulationOf({
        ...files,
        assets: files.assets.filter(({ kind }) => kind !== "orbiter"),
        milestones: files.milestones.filter(
          ({ trigger }) =>
            !("assetKindArrives" in trigger) ||
            trigger.assetKindArrives !== "orbiter",
        ),
      });
      const view = withoutIt.readProgram(program);
      expect(view.operatingAssets).toHaveLength(1);
      const plan = strategy.plan(view, planningTools(withoutIt, program));
      expect(withoutIt.validatePlan(program, plan).problems).toEqual([]);
    },
  );

  it("waits for a Survey before landing when it surveys first, and reveals more sites", () => {
    const certainly = simulationOf(certain);
    const surveyFirst = strategies.find(({ name }) => name === "survey first");
    if (!surveyFirst) throw new Error("Expected the survey first strategy");
    let program = certainly.startProgram(1);
    const landedAt: (string | undefined)[] = [];
    const known: number[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const view = certainly.readProgram(program);
      known.push(view.landingSites.length);
      const plan = surveyFirst.plan(view, planningTools(certainly, program));
      landedAt.push(plan.mission?.landingSiteId);
      if (plan.mission?.landingSiteId) {
        const site = view.landingSites.find(
          ({ id }) => id === plan.mission?.landingSiteId,
        );
        expect(site?.surveyed).toBe(true);
      }
      program = certainly.runTurn(program, plan).program;
    }
    // Turn 1 launches the orbiter and Turn 2 lands at the site with the most Science it has surveyed.
    expect(landedAt[0]).toBeUndefined();
    expect(landedAt[1]).toBe("jezero-crater");
    expect(known.at(-1)).toBeGreaterThan(known[0] ?? 0);
  });

  it("keeps an orbiter on Survey while a site is left to reveal, and stops after one if told to", () => {
    const certainly = simulationOf(certain);
    const named = (wanted: string) => {
      const strategy = strategies.find(({ name }) => name === wanted);
      if (!strategy) throw new Error(`Expected the strategy ${wanted}`);
      return strategy;
    };
    const secondTurn = (strategy: Strategy) => {
      const start = certainly.startProgram(1);
      const { program } = certainly.runTurn(
        start,
        strategy.plan(
          certainly.readProgram(start),
          planningTools(certainly, start),
        ),
      );
      return strategy.plan(
        certainly.readProgram(program),
        planningTools(certainly, program),
      );
    };
    expect(
      Object.values(
        secondTurn(named("steady: Soil analysis")).operatingActivities ?? {},
      ),
    ).toEqual([]);
    expect(
      Object.values(
        secondTurn(named("steady: Survey once")).operatingActivities ?? {},
      ),
    ).toEqual(["orbital-research"]);
  });

  it("keeps money back for a retry until Research Grants would pay for one", () => {
    const steady = strategies.find(
      ({ name }) => name === "steady: Soil analysis",
    );
    if (!steady) throw new Error("Expected the steady strategy");
    const certainly = simulationOf(certain);
    let program = certainly.startProgram(1);
    const carried: (string | undefined)[] = [];
    for (let turn = 0; turn < 3; turn++) {
      const plan = steady.plan(
        certainly.readProgram(program),
        planningTools(certainly, program),
      );
      carried.push(plan.mission?.assetIds[0]);
      program = certainly.runTurn(program, plan).program;
    }
    // On Turn 2 a rover would leave too little to try again, and on Turn 3 the money has come in.
    expect(carried).toEqual([
      "pathfinder-orbiter",
      "prospector-lander",
      "trailblazer-rover",
    ]);
  });

  it("gives an orbiter research once nothing is left to Survey", () => {
    const surveyFirst = strategies.find(({ name }) => name === "survey first");
    if (!surveyFirst) throw new Error("Expected the survey first strategy");
    const certainly = simulationOf({
      ...certain,
      landingSites: certain.landingSites.filter(
        ({ knownFromStart }) => knownFromStart,
      ),
      assets: certain.assets.map((asset) => ({
        ...asset,
        serviceLifeOptions: asset.serviceLifeOptions.map((option) => ({
          ...option,
          days: option.days + 780,
        })),
      })),
    });
    const first = surveyFirst.plan(
      certainly.readProgram(certainly.startProgram(1)),
      planningTools(certainly, certainly.startProgram(1)),
    );
    const { program } = certainly.runTurn(certainly.startProgram(1), first);
    const view = certainly.readProgram(program);
    const [orbiter] = view.operatingAssets;
    expect(orbiter?.activityId).toBe("survey");
    const second = surveyFirst.plan(view, planningTools(certainly, program));
    expect(second.operatingActivities).toEqual({
      [orbiter?.key ?? ""]: "orbital-research",
    });
  });
});

describe("playing a Program", () => {
  it("stops at cancellation, after which the Simulation refuses another Turn", () => {
    const played = playProgram(real, launchNothing, 1, turns);
    // 100 Public Support falling by 15% and rounding down: 85, 72, 61, 51, 43.
    expect(played.turns.map(({ publicSupport }) => publicSupport)).toEqual([
      85, 72, 61, 51, 43,
    ]);
    expect(played.turns.at(-1)?.cancelled).toBe(true);
    const plan = { mission: null };
    expect(real.validatePlan(played.program, plan).problems).toHaveLength(1);
    expect(() => real.runTurn(played.program, plan)).toThrow();
  });

  it("stops when the Turns run out", () => {
    expect(playProgram(real, launchNothing, 1, 2).turns).toHaveLength(2);
  });

  it("names the strategy, seed and Turn of a plan that fails validation", () => {
    const invalid: Strategy = {
      name: "test: invalid",
      description: "Launches something that doesn't exist.",
      plan: () => ({
        mission: { launchVehicleId: "no-such-vehicle", assetIds: [] },
      }),
    };
    expect(() => playProgram(real, invalid, 7, 1)).toThrow(
      /"test: invalid", seed 7, Turn 1: .*no-such-vehicle/,
    );
  });
});

describe("the checks for invalid states", () => {
  const start = real.startProgram(1);
  const { program, summary } = real.runTurn(start, {
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["pathfinder-orbiter"],
    },
  });
  const before = real.readProgram(start);
  const after = real.readProgram(program);

  it("find nothing wrong with a real Turn", () => {
    expect(invalidStates(before, summary, after)).toEqual([]);
  });

  const changedSummary = (changes: Partial<TurnSummary>) =>
    invalidStates(before, { ...summary, ...changes }, after);
  const changedAfter = (changes: Partial<ProgramView>) =>
    invalidStates(before, summary, { ...after, ...changes });

  it.each<[string, () => string[], RegExp]>([
    [
      "negative money",
      () => changedAfter({ moneyMillions: -1 }),
      /Money fell to -1/,
    ],
    [
      "Science falling",
      () =>
        invalidStates(
          { ...before, science: after.science + 1 },
          summary,
          after,
        ),
      /Science fell/,
    ],
    [
      "a cancelled Program carrying on",
      () =>
        invalidStates(
          { ...before, status: { kind: "cancelled", reason: "Test" } },
          summary,
          after,
        ),
      /cancelled Program played another Turn/,
    ],
    [
      "Public Support below zero",
      () => changedAfter({ publicSupport: -1 }),
      /Public Support is out of range/,
    ],
    [
      "Public Support that isn't whole",
      () => changedAfter({ publicSupport: 100.5 }),
      /Public Support is out of range/,
    ],
    [
      "moneyEndMillions not matching the next Program",
      () => changedSummary({ moneyEndMillions: summary.moneyEndMillions + 1 }),
      /moneyEndMillions doesn't match/,
    ],
    [
      "money that doesn't add up",
      () =>
        changedSummary({
          missionCostMillions: summary.missionCostMillions + 1,
        }),
      /money doesn't add up/,
    ],
    [
      "Research Grants that don't total up",
      () => changedSummary({ researchGrantMillions: 5 }),
      /researchGrantMillions isn't the total/,
    ],
    [
      "a low Program still active",
      () => changedAfter({ publicSupport: after.cancellationLevel - 1 }),
      /has the status active/,
    ],
    [
      "a cancellation without a status",
      () => changedSummary({ cancellationReason: "Test" }),
      /cancellation doesn't match/,
    ],
    [
      "a repeated Milestone",
      () =>
        changedAfter({
          milestones: [...after.milestones, ...after.milestones],
        }),
      /Milestone was awarded twice or lost/,
    ],
    [
      "a forgotten Landing Site",
      () => changedAfter({ landingSites: [] }),
      /Landing Site was forgotten/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});

describe("the report", () => {
  const report = balanceReport(files, 3, [launchNothing]);

  /** The cells of one row of a strategy's Turn table, with the Turn number first. */
  const turnRow = (text: string, turn: number) =>
    text
      .split("\n")
      .find((line) => line.startsWith(`${String(turn).padEnd(4)}  `))
      ?.trim()
      .split(/\s+/);

  it("gives the same bytes every time", () => {
    expect(balanceReport(files, 3, [launchNothing])).toBe(report);
    expect(balanceReport(files, 3)).toBe(balanceReport(files, 3));
  });

  it("covers a strategy with no change to anything else", () => {
    expect(report).toContain("== test: launch nothing ==");
    expect(report).toContain("seeds 1 to 3");
  });

  it("shows when a Program that launches nothing is cancelled", () => {
    expect(report).toContain("Cancelled: 100.0% of Programs, on Turn 5.0");
    expect(report).toContain(`  Turn  5 100.0% ${"#".repeat(40)}`);
    expect(report).toContain("First Mission failed: never");
    expect(turnRow(report, 4)).toEqual(
      "4 100.0 2300 0 51 0.0 0 0 0 - -".split(" "),
    );
    expect(turnRow(report, 5)).toEqual(
      "5 0.0 2300 0 43 0.0 0 0 0 - -".split(" "),
    );
    expect(turnRow(report, 6)).toBeUndefined();
  });

  it("counts a Funding Threshold's payout as income, and the Research Grant separately", () => {
    const landOnce: Strategy = {
      name: "test: land once",
      description: "Lands one lander on the first Turn.",
      plan: (view) => ({
        mission:
          view.turnNumber === 1
            ? {
                launchVehicleId: "meridian-medium",
                assetIds: ["prospector-lander"],
                landingSiteId: "jezero-crater",
              }
            : null,
      }),
    };
    const text = balanceReport(certain, 2, [landOnce]);
    // 2300 - 1100 + 1000 from the first Funding Threshold + a Research Grant of 37, with
    // 570 of 780 days at 100 Science a Turn being 73 Science, plus 150 and 120 for the landing.
    // (100 + 250 for the landing + 7 of research) less 15% is 303 Public Support.
    expect(turnRow(text, 1)).toEqual(
      "1 100.0 2237 343 303 1.0 1100 1000 37 96.4 3.6".split(" "),
    );
    expect(text).toMatch(/^250 +1000 +100\.0 +1\.0$/m);
    expect(text).toMatch(/^425 +1500 +0\.0 +-$/m);
    expect(text).toContain("Surface research");
  });

  it("says when Research Grants take over, and when they never do", () => {
    expect(report).toContain(
      "Research Grants pass Funding Thresholds: each Turn never, in total never",
    );
    const keepsARover: Strategy = {
      name: "test: one rover",
      description: "Lands one rover on the first Turn and keeps it at work.",
      plan: (view) => ({
        mission:
          view.turnNumber === 1
            ? {
                launchVehicleId: "meridian-medium",
                assetIds: ["trailblazer-rover"],
                landingSiteId: "jezero-crater",
                assetChoices: {
                  "trailblazer-rover": {
                    serviceLifeDays: 2800,
                    activityId: "soil-analysis",
                  },
                },
              }
            : null,
      }),
    };
    expect(balanceReport(certain, 2, [keepsARover])).toMatch(
      /Research Grants pass Funding Thresholds: each Turn from Turn \d+ on, in total by Turn \d+/,
    );
  });

  it("says who is cancelled with an Asset still operating", () => {
    expect(report).toContain(", 0.0% with an Asset still operating");
  });

  it("shows how Programs end up after their first Mission", () => {
    const text = balanceReport(certain, 2, [
      strategies.find(({ name }) => name === "steady: Soil analysis") ??
        launchNothing,
    ]);
    expect(text).toMatch(/First Mission worked \(100\.0%\): ends with \$\d+M/);
    expect(text).not.toContain("First Mission failed (");
  });
});
