import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { crewProblems } from "./invalidCrew";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { certain, simulationOf, turns } from "./testHelpers";

/** Nothing fails, and the Meridian Colossus is built and Flight-proven from the start, so Crew can fly on Turn 1. */
const simulation = simulationOf({
  ...certain,
  program: { ...certain.program, startingMoneyMillions: 20_000 },
  launchVehicles: certain.launchVehicles.map(
    ({ id, name, costMillions, capacityTonnes, missionEvents }) => ({
      id,
      name,
      costMillions,
      capacityTonnes,
      missionEvents,
      technologyReadiness: "flight-proven" as const,
    }),
  ),
});
const crewed = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: { size: 2 },
  },
};

describe("strategies that fly Crew", () => {
  const flying = strategies.filter(({ name }) => name.includes("Crew"));

  it("exist", () => {
    expect(flying.length).toBeGreaterThan(0);
  });

  it.each(flying.map((strategy) => [strategy.name, strategy] as const))(
    "%s gets Crew to Mars once it can carry them, and keeps them at research",
    (_, strategy) => {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      const [group] = certainly.readProgram(program).crew;
      expect(group?.members.length).toBeGreaterThan(0);
      expect(group?.activityName).toBe("Crew research");
    },
  );

  it("are the only ones that fly Crew", () => {
    for (const strategy of strategies.filter(
      (each) => !flying.includes(each),
    )) {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      expect(certainly.readProgram(program).crew).toEqual([]);
    }
  });
});

describe("the checks for invalid Crew", () => {
  const start = simulation.startProgram(1);
  const first = simulation.runTurn(start, crewed);
  const second = simulation.runTurn(first.program, crewed);
  const before = simulation.readProgram(first.program);
  const after = simulation.readProgram(second.program);
  const { summary } = second;

  it("find nothing wrong with Crew arriving, and joining Crew already there", () => {
    expect(
      crewProblems(simulation.readProgram(start), first.summary, before),
    ).toEqual([]);
    expect(crewProblems(before, summary, after)).toEqual([]);
    expect(after.crew[0]?.members).toHaveLength(4);
  });

  const [group] = after.crew;
  if (!group) throw new Error("No Crew arrived");
  const withMembers = (members: typeof group.members) =>
    crewProblems(before, summary, { ...after, crew: [{ ...group, members }] });
  const changedSummary = (changes: Partial<TurnSummary>) =>
    crewProblems(before, { ...summary, ...changes }, after);
  const changedAfter = (changes: Partial<ProgramView>) =>
    crewProblems(before, summary, { ...after, ...changes });

  it.each<[string, () => string[], RegExp]>([
    [
      "two Crew members with one name",
      () => withMembers([...group.members, ...group.members.slice(0, 1)]),
      /share a name/,
    ],
    [
      "a Crew member disappearing",
      () => withMembers(group.members.slice(1)),
      /disappeared/,
    ],
    [
      "Health above the most there is",
      () =>
        withMembers(
          group.members.map((member) => ({ ...member, health: 101 })),
        ),
      /Health is outside 0 to 100/,
    ],
    [
      "Health below zero",
      () =>
        withMembers(group.members.map((member) => ({ ...member, health: -1 }))),
      /Health is outside/,
    ],
    [
      "Crew doing an Activity they can't do",
      () => changedAfter({ crew: [{ ...group, activityId: "survey" }] }),
      /an Activity they can't do/,
    ],
    [
      "the same place listed twice",
      () => changedAfter({ crew: [group, group] }),
      /listed twice/,
    ],
    [
      "names given without Crew arriving",
      () =>
        changedAfter({
          crewedMission: { ...after.crewedMission, namesLeft: 0 },
        }),
      /names left to give Crew/,
    ],
    [
      "a Turn summary missing Crew",
      () => changedSummary({ crew: [] }),
      /Turn summary don't match/,
    ],
    [
      "a Turn summary that has the wrong Crew arriving",
      () =>
        changedSummary({
          crew: summary.crew.map((member) => ({ ...member, arrived: true })),
        }),
      /Turn summary don't match/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
