import { describe, expect, it } from "vitest";
import type { Program, Simulation, TurnPlan } from "./simulation";
import { steadyHealth, withFailures } from "./testHelpers";

/*
 * Crew bringing samples home: a rover caches 15 samples at Alpha Plain on the first Turn and 20 more on the second,
 * beside a fuel plant, while round-trip Crew of two land there on the second Turn. On the third, they come home through
 * Mars ascent with the 35 samples there as the Turn starts and 3 samples each of their own, 41 in all, at 10 Science
 * each.
 */

const stageKey = "earth-return-stage:2031-08-13";
const bringThemHome: TurnPlan = { mission: null, bringHome: stageKey };

/** A Program on its third Turn, with round-trip Crew and cached samples at Alpha Plain. */
function crewBesideSamples(failing: string[] = []): {
  simulation: Simulation;
  program: Program;
} {
  const { simulation, program } = withFailures(failing, {
    startingMoneyMillions: 9000,
    crewHealth: steadyHealth,
  });
  const cached = simulation.runTurn(program, {
    mission: {
      launchVehicleId: "test-heavy",
      assetIds: ["test-rover", "test-fuel-plant"],
      landingSiteId: "alpha-plain",
      assetChoices: { "test-rover": { activityId: "test-caching" } },
    },
  }).program;
  return {
    simulation,
    program: simulation.runTurn(cached, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: [],
        landingSiteId: "alpha-plain",
        crew: { size: 2, roundTrip: true, landsAtSite: true },
      },
    }).program,
  };
}

const samplesAtAlpha = (simulation: Simulation, program: Program) =>
  simulation
    .readProgram(program)
    .landingSites.find(({ id }) => id === "alpha-plain")?.samples;

describe("Crew bringing samples home", () => {
  it("says how many samples Crew at a Landing Site would bring home", () => {
    const { simulation, program } = crewBesideSamples();
    expect(samplesAtAlpha(simulation, program)).toBe(35);
    const [way] = simulation.readProgram(program).crew[0]?.waysHome ?? [];
    expect(way).toMatchObject({ key: stageKey, samples: 35 + 2 * 3 });
  });

  it("brings the site's samples and samples of their own home with them, earning Science and the Milestone", () => {
    const { simulation, program } = crewBesideSamples();
    const { program: next, summary } = simulation.runTurn(
      program,
      bringThemHome,
    );
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(summary.samplesHome).toEqual([
      { from: "Alpha Plain", samples: 41, science: 410, broughtBy: "Crew" },
    ]);
    expect(summary.milestones.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["First samples home", "First Crew home"]),
    );
    // What the rover caches this Turn stays for later.
    expect(samplesAtAlpha(simulation, next)).toBe(20);
  });

  it("loses the samples with the Crew if the journey home fails", () => {
    const { simulation, program } = crewBesideSamples(["test-splashdown"]);
    const { program: next, summary } = simulation.runTurn(
      program,
      bringThemHome,
    );
    expect(summary.samplesHome).toEqual([]);
    expect(summary.journeyHome?.samples).toBe(41);
    expect(samplesAtAlpha(simulation, next)).toBe(20);
  });

  it("brings no samples from Mars orbit", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
      crewHealth: steadyHealth,
    });
    const there = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: [],
        crew: { size: 2, roundTrip: true },
      },
    }).program;
    const [way] = simulation.readProgram(there).crew[0]?.waysHome ?? [];
    expect(way?.samples).toBe(0);
    const { summary } = simulation.runTurn(there, {
      mission: null,
      bringHome: way?.key ?? "",
    });
    expect(summary.crewHome).toHaveLength(2);
    expect(summary.samplesHome).toEqual([]);
  });
});
