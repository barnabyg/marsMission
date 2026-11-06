import { describe, expect, it } from "vitest";
import type {
  Program,
  ProgramView,
  TurnSummary,
} from "../simulation/simulation";
import { crewProblems } from "./invalidCrew";
import { habitatProblems } from "./invalidHabitats";
import { planningTools, playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);
const site = "Jezero Crater";

/** Crew and a habitat landed together at Jezero Crater, then the Program before and after the next Turn, with its summary. */
function housedCrew() {
  const landing = simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: ["haven-habitat"],
      crew: { size: 2, landsAtSite: true },
      landingSiteId: "jezero-crater",
      // Long enough to operate through the next Turn.
      assetChoices: { "haven-habitat": { serviceLifeDays: 2100 } },
    },
  });
  const before = simulation.readProgram(landing.program);
  const { summary, program } = simulation.runTurn(landing.program, {
    mission: null,
  });
  return {
    landing: {
      summary: landing.summary,
      after: before,
      before: simulation.readProgram(simulation.startProgram(1)),
    },
    before,
    summary,
    after: simulation.readProgram(program),
  };
}

describe("the strategy that lands Crew beside a habitat", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("land Crew beside a habitat"),
  );
  if (!strategy) throw new Error("No strategy lands a habitat");
  /** The strategy's plan for this Program, played, with the plan. */
  const played = (program: Program) => {
    const plan = strategy.plan(
      simulation.readProgram(program),
      planningTools(simulation, program),
    );
    return { plan, ...simulation.runTurn(program, plan) };
  };
  // An orbiter's Survey makes a Landing Site safer, which the strategy's Crew wait for.
  const surveyed = simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["pathfinder-orbiter"],
    },
  }).program;
  const first = played(surveyed);

  it("lands a habitat with its Crew at a surveyed Landing Site, which saves them Health", () => {
    expect(first.plan.mission?.assetIds).toEqual(["haven-habitat"]);
    expect(first.plan.mission?.crew?.landsAtSite).toBe(true);
    expect(first.summary.healthLost[0]?.savedByHabitat).toBeGreaterThan(0);
  });

  it("lands later Crew beside the habitat already there, with none aboard", () => {
    const later = played(first.program);
    expect(later.plan.mission?.crew?.landsAtSite).toBe(true);
    expect(later.plan.mission?.landingSiteId).toBe(
      first.plan.mission?.landingSiteId,
    );
    expect(later.plan.mission?.assetIds).toEqual([]);
  });

  it("plays whole Programs without an invalid state", () => {
    expect(() => playProgram(simulation, strategy, 1, turns)).not.toThrow();
  });
});

describe("the checks for invalid habitats", () => {
  const { landing, before, summary, after } = housedCrew();
  const withHeld = (view: ProgramView, kg: number): ProgramView => ({
    ...view,
    landingSites: view.landingSites.map((each) =>
      each.name === site ? { ...each, habitatSuppliesKg: kg } : each,
    ),
  });
  const changedSummary = (changes: Partial<TurnSummary>) =>
    habitatProblems(before, { ...summary, ...changes }, after);
  const savedBy = (health: number) =>
    summary.healthLost.map((each) => ({ ...each, savedByHabitat: health }));

  it("find nothing wrong with Crew living beside a habitat", () => {
    expect(summary.healthLost[0]?.savedByHabitat).toBeGreaterThan(0);
    expect(
      after.landingSites.find(({ name }) => name === site)?.habitatSuppliesKg,
    ).toBeGreaterThan(0);
    expect(habitatProblems(before, summary, after)).toEqual([]);
    expect(crewProblems(before, summary, after)).toEqual([]);
  });

  it("find nothing wrong with a habitat landing beside Crew, whose Supplies it adds to", () => {
    expect(
      habitatProblems(landing.before, landing.summary, landing.after),
    ).toEqual([]);
    expect(
      crewProblems(landing.before, landing.summary, landing.after),
    ).toEqual([]);
  });

  it.each<[string, () => string[], RegExp]>([
    [
      "a negative amount of Supplies",
      () => habitatProblems(before, summary, withHeld(after, -1)),
      /negative amount/,
    ],
    [
      "more Supplies than the habitats there hold",
      () => habitatProblems(before, summary, withHeld(after, 1_000_000)),
      /more Supplies than the habitats operating there can/,
    ],
    [
      "Supplies held where no habitat operates",
      () =>
        habitatProblems(before, summary, {
          ...withHeld(after, 10),
          operatingAssets: [],
        }),
      /more Supplies than the habitats operating there can/,
    ],
    [
      "no Health saved, or some lost",
      () => changedSummary({ healthLost: savedBy(0) }),
      /saved a Crew member no Health/,
    ],
    [
      "Health saved for Crew with no habitat",
      () =>
        changedSummary({
          healthLost: [
            ...savedBy(5),
            { name: "Nobody Known", lost: [], savedByHabitat: 5 },
          ],
        }),
      /at no Landing Site with a habitat/,
    ],
    [
      "Health saved with no habitat at Mars",
      () =>
        habitatProblems({ ...before, operatingAssets: [] }, summary, {
          ...after,
          operatingAssets: [],
        }),
      /no habitat operating at Mars/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
