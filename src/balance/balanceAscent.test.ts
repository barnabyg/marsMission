import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { homecomingProblems } from "./invalidHomecomings";
import { propellantProblems } from "./invalidPropellant";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);
const site = "Jezero Crater";

/**
 * A fuel plant landed at Jezero Crater on Turn 1, round-trip Crew landed beside it on Turn 2, and the Program before and
 * after the Turn that brings them home through Mars ascent, with that Turn's summary.
 */
function broughtHomeFromTheSurface() {
  const withPlant = simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["wellspring-fuel-plant"],
      landingSiteId: "jezero-crater",
    },
  }).program;
  const there = simulation.runTurn(withPlant, {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: [],
      landingSiteId: "jezero-crater",
      crew: { size: 2, roundTrip: true, landsAtSite: true },
    },
  }).program;
  const before = simulation.readProgram(there);
  const bringHome = before.crew[0]?.waysHome[0]?.key ?? "";
  const { summary, program } = simulation.runTurn(there, {
    mission: null,
    bringHome,
  });
  return { before, summary, after: simulation.readProgram(program) };
}

describe("the strategy that brings Crew home from beside a fuel plant", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("round-trip Crew beside a fuel plant"),
  );

  it("lands round-trip Crew beside its fuel plant and brings them home through Mars ascent", () => {
    if (!strategy) throw new Error("No strategy lands round-trip Crew");
    const { turns: played } = playProgram(simulation, strategy, 1, turns);
    const ascents = played.filter(
      ({ ascentPropellantUsedKg }) => ascentPropellantUsedKg > 0,
    );
    expect(ascents.length).toBeGreaterThan(0);
    expect(ascents.every(({ crewHome }) => crewHome > 0)).toBe(true);
  });
});

describe("the checks for Crew leaving the surface", () => {
  const { before, summary, after } = broughtHomeFromTheSurface();
  const [used] = summary.ascentPropellantUsed;

  it("find nothing wrong with Crew coming home through Mars ascent", () => {
    expect(summary.crewHome).toHaveLength(2);
    expect(used?.siteName).toBe(site);
    expect(propellantProblems(before, summary, after)).toEqual([]);
    expect(homecomingProblems(before, summary, after)).toEqual([]);
  });

  const withPropellant = (view: ProgramView, kg: number): ProgramView => ({
    ...view,
    landingSites: view.landingSites.map((each) =>
      each.name === site ? { ...each, ascentPropellantKg: kg } : each,
    ),
  });
  const changedSummary = (changes: Partial<TurnSummary>) =>
    propellantProblems(before, { ...summary, ...changes }, after);

  it.each<[string, () => string[], RegExp]>([
    [
      "propellant used but not reported",
      () => changedSummary({ ascentPropellantUsed: [] }),
      /didn't change by what the Turn summary says/,
    ],
    [
      "more used than Mars ascent needs",
      () =>
        changedSummary({
          ascentPropellantUsed: summary.ascentPropellantUsed.map((each) => ({
            ...each,
            usedKg: each.usedKg + 1,
          })),
        }),
      /not as much as Mars ascent needs/,
    ],
    [
      "propellant used where no Crew left",
      () =>
        changedSummary({
          ascentPropellantUsed: summary.ascentPropellantUsed.map((each) => ({
            ...each,
            siteName: "Gale Crater",
          })),
        }),
      /that Crew didn't leave/,
    ],
    [
      "Crew leaving with too little propellant there",
      () =>
        homecomingProblems(
          withPropellant(before, 1),
          summary,
          withPropellant(after, 1),
        ),
      /offered though there isn't/,
    ],
    [
      "a way home barred though there is enough propellant",
      () =>
        homecomingProblems(
          {
            ...before,
            crew: before.crew.map((place) => ({
              ...place,
              waysHome: place.waysHome.map((way) => ({
                ...way,
                reason: "Not enough.",
              })),
            })),
          },
          summary,
          after,
        ),
      /barred though there is enough/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
