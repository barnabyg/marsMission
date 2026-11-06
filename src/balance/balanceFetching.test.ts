import { describe, expect, it } from "vitest";
import type {
  ProgramView,
  TurnPlan,
  TurnSummary,
} from "../simulation/simulation";
import { fetchingProblems } from "./invalidFetching";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);
const oneWay: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    // Heavy shielding, so that they live long enough to be fetched and brought home.
    crew: {
      size: 2,
      suppliesId: "supplies-ample",
      protectionId: "protection-heavy-shielding",
    },
  },
};
const fetching: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-heavy",
    assetIds: [],
    returnVehicle: { forCrewAt: "mars-orbit" },
  },
};

/** The Program before and after a Turn that sends a return vehicle for one-way Crew in Mars orbit, with its summary. */
function fetched() {
  const there = simulation.runTurn(simulation.startProgram(1), oneWay).program;
  const { summary, program } = simulation.runTurn(there, fetching);
  return {
    before: simulation.readProgram(there),
    summary,
    after: simulation.readProgram(program),
  };
}

describe("the strategy that fetches Crew", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("fetch them with a return vehicle"),
  );

  it("sends Crew one way, fetches them with a return vehicle and brings them home", () => {
    if (!strategy) throw new Error("No strategy fetches Crew");
    const { turns: played } = playProgram(simulation, strategy, 1, turns);
    expect(played.some(({ crewHome }) => crewHome > 0)).toBe(true);
  });
});

describe("the checks for invalid fetching", () => {
  const { before, summary, after } = fetched();

  it("find nothing wrong with a return vehicle that waits for one-way Crew", () => {
    expect(summary.returnVehicle?.crew).toHaveLength(2);
    expect(fetchingProblems(before, summary, after)).toEqual([]);
  });

  const [first = ""] = summary.returnVehicle?.crew ?? [];
  const changedSummary = (changes: Partial<TurnSummary>) =>
    fetchingProblems(before, { ...summary, ...changes }, after);
  const twice: ProgramView = {
    ...after,
    crew: after.crew.map((place) => ({
      ...place,
      waysHome: [...place.waysHome, ...place.waysHome],
    })),
  };

  it.each<[string, () => string[], RegExp]>([
    [
      "a Crew member with two ways home",
      () => fetchingProblems(before, summary, twice),
      /more than one way home/,
    ],
    [
      "a Crew member listed with and without a way home",
      () =>
        fetchingProblems(before, summary, {
          ...after,
          crew: after.crew.map((place) => ({
            ...place,
            withoutWayHome: [first],
          })),
        }),
      /both with and without a way home/,
    ],
    [
      "a return vehicle for Crew who had a way home",
      () =>
        changedSummary({
          returnVehicle: { name: "Homeward", crew: ["Someone"] },
        }),
      /had a way home already/,
    ],
    [
      "a return vehicle for more Crew than it has room for",
      () =>
        changedSummary({
          returnVehicle: {
            name: "Homeward",
            crew: [...(summary.returnVehicle?.crew ?? []), first, first, first],
          },
        }),
      /more Crew than it has room for/,
    ],
    [
      "a way home for Crew with none without a return vehicle",
      () => changedSummary({ returnVehicle: null }),
      /without a return vehicle/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
