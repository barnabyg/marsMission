import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { invalidStates } from "./invalidStates";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { certain, real, simulationOf, turns } from "./testHelpers";

const developing = strategies.filter(({ name }) => name.includes("develop"));

describe("strategies that develop technology", () => {
  it("exist", () => {
    expect(developing.length).toBeGreaterThan(0);
  });

  it.each(developing.map((strategy) => [strategy.name, strategy] as const))(
    "%s develops the Endurance Rover, then sends it once it is built, which makes it Flight-proven",
    (_, strategy) => {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      const view = certainly.readProgram(program);
      expect(
        view.developments.find(({ id }) => id === "endurance-rover")?.status,
      ).toBe("finished");
      expect(
        view.assets.find(({ id }) => id === "endurance-rover")
          ?.technologyReadiness,
      ).toBe("flight-proven");
    },
  );

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
