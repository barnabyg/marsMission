import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { invalidStates } from "./invalidStates";
import { planningTools, playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { certain, real, simulationOf, turns } from "./testHelpers";

const developing = strategies.filter(({ name }) => name.includes("develop"));

describe("strategies that develop technology", () => {
  it("exist", () => {
    expect(developing.length).toBeGreaterThan(0);
  });

  /** What each one develops, by the name it is reported under. */
  const technologyOf = (name: string) =>
    name.includes("Meridian Colossus")
      ? "meridian-colossus"
      : "endurance-rover";

  it.each(developing.map((strategy) => [strategy.name, strategy] as const))(
    "%s develops its technology, then flies it once it is built, which makes it Flight-proven",
    (name, strategy) => {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      const view = certainly.readProgram(program);
      const id = technologyOf(name);
      expect(view.developments.find((each) => each.id === id)?.status).toBe(
        "finished",
      );
      expect(
        [...view.assets, ...view.launchVehicles].find((each) => each.id === id)
          ?.technologyReadiness,
      ).toBe("flight-proven");
    },
  );

  it("fly more than one Asset at once on the Meridian Colossus once it is built", () => {
    const strategy = developing.find(({ name }) =>
      name.endsWith("develop the Meridian Colossus"),
    );
    if (!strategy) throw new Error("Expected the strategy");
    const certainly = simulationOf(certain);
    let program = certainly.startProgram(1);
    const launched: string[][] = [];
    for (let turn = 1; turn <= turns; turn++) {
      const plan = strategy.plan(
        certainly.readProgram(program),
        planningTools(certainly, program),
      );
      if (plan.mission?.launchVehicleId === "meridian-colossus") {
        launched.push(plan.mission.assetIds);
      }
      program = certainly.runTurn(program, plan).program;
    }
    expect(launched.some((assetIds) => assetIds.length > 1)).toBe(true);
  });

  it("fill a big Launch Vehicle only once rich, and fly three Assets at once only on the Meridian Colossus", () => {
    const launches = (name: string) => {
      const strategy = strategies.find((each) => each.name === name);
      if (!strategy) throw new Error(`Expected the strategy "${name}"`);
      const certainly = simulationOf(certain);
      let program = certainly.startProgram(1);
      const launched: { assetIds: string[]; moneyMillions: number }[] = [];
      for (let turn = 1; turn <= turns; turn++) {
        const view = certainly.readProgram(program);
        if (view.status.kind !== "active") break;
        const plan = strategy.plan(view, planningTools(certainly, program));
        if (plan.mission) {
          launched.push({
            assetIds: plan.mission.assetIds,
            moneyMillions: view.moneyMillions,
          });
        }
        program = certainly.runTurn(program, plan).program;
      }
      return launched;
    };
    const heavy = launches("big Program: fill the Meridian Heavy when rich");
    const colossus = launches(
      "big Program: develop the Meridian Colossus when rich",
    );
    for (const { assetIds, moneyMillions } of [...heavy, ...colossus]) {
      if (assetIds.length > 1)
        expect(moneyMillions).toBeGreaterThanOrEqual(5000);
    }
    expect(heavy.some(({ assetIds }) => assetIds.length === 2)).toBe(true);
    expect(heavy.every(({ assetIds }) => assetIds.length <= 2)).toBe(true);
    expect(colossus.some(({ assetIds }) => assetIds.length === 3)).toBe(true);
  });

  it("are the only ones that start Development", () => {
    for (const strategy of strategies.filter(
      (each) => !developing.includes(each),
    )) {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      expect(
        new Set(
          certainly
            .readProgram(program)
            .developments.map(({ status }) => status),
        ),
      ).toEqual(new Set(["notStarted"]));
    }
  });
});

describe("the checks for invalid states with Development", () => {
  const start = real.startProgram(1);
  const { program, summary } = real.runTurn(start, {
    mission: null,
    developmentIds: ["endurance-rover"],
  });
  const before = real.readProgram(start);
  const after = real.readProgram(program);

  it("find nothing wrong with a Turn that starts Development", () => {
    expect(invalidStates(before, summary, after)).toEqual([]);
  });

  const changedSummary = (changes: Partial<TurnSummary>) =>
    invalidStates(before, { ...summary, ...changes }, after);
  const changedAfter = (changes: Partial<ProgramView>) =>
    invalidStates(before, summary, { ...after, ...changes });

  it.each<[string, () => string[], RegExp]>([
    [
      "money that doesn't add up without the Development",
      () => changedSummary({ developmentCostMillions: 0 }),
      /money doesn't add up/,
    ],
    [
      "a Development started that the Turn summary doesn't list",
      () => changedSummary({ developmentsStarted: [] }),
      /Developments that started don't match/,
    ],
    [
      "a Development finished that the Turn summary doesn't list",
      () => changedSummary({ developmentsFinished: ["Endurance Rover"] }),
      /Developments that finished don't match/,
    ],
    [
      "a Development that doesn't go on by one Turn",
      () =>
        changedAfter({
          developments: after.developments.map((development) => ({
            ...development,
            turnsLeft: development.turns,
          })),
        }),
      /didn't go on by one Turn/,
    ],
    [
      "a technology that is built before its Development finishes",
      () =>
        changedAfter({
          assets: after.assets.map((asset) => ({
            ...asset,
            technologyReadiness:
              asset.technologyReadiness === "not-built"
                ? ("built" as const)
                : asset.technologyReadiness,
          })),
        }),
      /Technology Readiness doesn't match its Development/,
    ],
    [
      "a technology flying before its Development finished",
      () => changedSummary({ technologiesProven: ["Endurance Rover"] }),
      /flew before its Development finished/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
