import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { propellantProblems } from "./invalidPropellant";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);

/** The Program before and after the Turn after a fuel plant landed at Jezero Crater, with that Turn's summary. */
function makingPropellant() {
  const landed = simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["wellspring-fuel-plant"],
      landingSiteId: "jezero-crater",
    },
  }).program;
  const before = simulation.readProgram(landed);
  const { summary, program } = simulation.runTurn(landed, { mission: null });
  return { before, summary, after: simulation.readProgram(program) };
}

describe("the strategy that lands a fuel plant", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("land Crew and a fuel plant"),
  );

  it("lands one, which makes ascent propellant from Turn to Turn", () => {
    if (!strategy) throw new Error("No strategy lands a fuel plant");
    const { turns: played } = playProgram(simulation, strategy, 1, turns);
    const making = played.filter(
      ({ ascentPropellantKg }) => ascentPropellantKg > 0,
    );
    expect(making.length).toBeGreaterThan(1);
  });
});

describe("the checks for invalid ascent propellant", () => {
  const { before, summary, after } = makingPropellant();
  const [made] = summary.ascentPropellant;
  const site = "Jezero Crater";
  const withPropellant = (view: ProgramView, kg: number): ProgramView => ({
    ...view,
    landingSites: view.landingSites.map((each) =>
      each.name === site ? { ...each, ascentPropellantKg: kg } : each,
    ),
  });
  const changedSummary = (changes: Partial<TurnSummary>) =>
    propellantProblems(before, { ...summary, ...changes }, after);

  it("find nothing wrong with a fuel plant making propellant", () => {
    expect(made?.siteName).toBe(site);
    expect(made?.madeKg).toBeGreaterThan(0);
    expect(propellantProblems(before, summary, after)).toEqual([]);
  });

  it.each<[string, () => string[], RegExp]>([
    [
      "a fractional amount",
      () => propellantProblems(before, summary, withPropellant(after, 0.5)),
      /negative or fractional/,
    ],
    [
      "propellant that fell",
      () =>
        propellantProblems(
          withPropellant(before, (made?.totalKg ?? 0) + 1),
          summary,
          after,
        ),
      /fell at a Landing Site/,
    ],
    [
      "propellant made but not reported",
      () => changedSummary({ ascentPropellant: [] }),
      /didn't change by what the Turn summary says/,
    ],
    [
      "a total that doesn't match the next Program",
      () =>
        propellantProblems(
          before,
          summary,
          withPropellant(after, (made?.totalKg ?? 0) + 10),
        ),
      /doesn't match the next Program's/,
    ],
    [
      "propellant made by something other than a fuel plant there",
      () =>
        changedSummary({
          ascentPropellant: summary.ascentPropellant.map((each) => ({
            ...each,
            madeBy: ["Prospector Lander"],
          })),
        }),
      /something other than a fuel plant/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
