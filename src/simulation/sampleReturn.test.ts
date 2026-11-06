import { describe, expect, it } from "vitest";
import type { Program, Simulation, TurnPlan } from "./simulation";
import type { PlannedMission } from "./types";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { withFailures } from "./testHelpers";

/*
 * Sending samples home: on the second Turn, the Test Lifter at Alpha Plain flies the 15 samples the Test Rover cached
 * there on the first up through the test ascent on day 100 and the docking with the Test Return Orbiter on day 101,
 * which fires for home on day 102 and splashes down on day 300. Each sample earns 10 Science, and the first are worth
 * the First samples home Milestone.
 */

/** The rover on Sample caching, the ascent vehicle beside it and the Earth return orbiter, all on one Mission. */
function everything(contingencyIds: string[] = []): PlannedMission {
  return {
    launchVehicleId: "test-heavy",
    assetIds: ["test-rover", "test-ascent-vehicle", "test-return-orbiter"],
    landingSiteId: "alpha-plain",
    assetChoices: { "test-rover": { activityId: "test-caching" } },
    contingencyIds,
  };
}

const sendHome: TurnPlan = { mission: null, bringHome: "samples:alpha-plain" };

/** A Program on its second Turn with samples ready to go home, in a Simulation whose named Mission Events fail. */
function ready(
  failing: string[] = [],
  mission: PlannedMission = everything(),
): { simulation: Simulation; program: Program } {
  const { simulation, program } = withFailures(failing, {
    startingMoneyMillions: 5000,
  });
  return {
    simulation,
    program: simulation.runTurn(program, { mission }).program,
  };
}

const kindsOperating = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).operatingAssets.map(({ kind }) => kind);

const samplesAtAlpha = (simulation: Simulation, program: Program) =>
  simulation
    .readProgram(program)
    .landingSites.find(({ id }) => id === "alpha-plain")?.samples;

describe("buying the samples' journey home at launch", () => {
  it("lists Mars ascent and the rendezvous for an ascent vehicle, and the journey home for an Earth return orbiter, with their Contingencies", () => {
    const { simulation, program } = withFailures([]);
    const homeward = (assetIds: string[]) =>
      simulation
        .previewMission(program, {
          launchVehicleId: "test-heavy",
          assetIds,
          landingSiteId: "alpha-plain",
        })
        .filter(({ homeward }) => homeward)
        .map(({ name }) => name);
    expect(homeward(["test-ascent-vehicle"])).toEqual([
      "Test ascent",
      "Test docking",
    ]);
    expect(homeward(["test-return-orbiter"])).toEqual([
      "Test departure home",
      "Test splashdown",
    ]);
    expect(homeward(["test-ascent-vehicle", "test-return-orbiter"])).toEqual([
      "Test ascent",
      "Test docking",
      "Test departure home",
      "Test splashdown",
    ]);
  });

  it("charges for the Reliability and Contingencies bought for it with the Mission", () => {
    const { simulation, program } = withFailures([]);
    const cost = (mission: PlannedMission) =>
      simulation.validatePlan(program, { mission }).costMillions;
    expect(
      cost({
        ...everything(["test-ascent-restart"]),
        reliability: { "test-departure-home": "tested" },
      }) - cost(everything()),
    ).toBeGreaterThan(50);
  });
});

describe("sending samples home", () => {
  it("flies the ascent vehicle up to the Earth return orbiter, which flies them home, earning Science and the Milestone", () => {
    const { simulation, program } = ready();
    const {
      program: next,
      timeline,
      summary,
    } = simulation.runTurn(program, sendHome);
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "missionEvent" || kind === "samples")
        .map(({ day, title }) => [day, title]),
    ).toEqual([
      [100, "Test ascent"],
      [101, "Test docking"],
      [102, "Test departure home"],
      [300, "Test splashdown"],
      [300, "Samples home"],
    ]);
    expect(summary.samplesHome).toEqual([
      {
        from: "Alpha Plain",
        samples: 15,
        science: 150,
        broughtBy: "Test Return Orbiter",
      },
    ]);
    expect(summary.sampleJourney).toEqual({
      siteName: "Alpha Plain",
      samples: 15,
      failure: null,
      stayed: false,
    });
    expect(summary.milestones.map(({ name }) => name)).toContain(
      "First samples home",
    );
    expect(summary.scienceGained).toBe(150 + 500);
    // The rover caches a whole Turn's worth more, and the two that flew are gone.
    expect(samplesAtAlpha(simulation, next)).toBe(20);
    expect(kindsOperating(simulation, next)).toEqual(["rover"]);
    expect(summary.assetsEnded).toEqual([]);
  });

  it("awards the Milestone only once", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 9000,
    });
    let next = simulation.runTurn(program, { mission: everything() }).program;
    next = simulation.runTurn(next, {
      ...sendHome,
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-ascent-vehicle", "test-return-orbiter"],
        landingSiteId: "alpha-plain",
      },
    }).program;
    const { summary } = simulation.runTurn(next, sendHome);
    expect(summary.samplesHome[0]?.samples).toBe(20);
    expect(summary.milestones).toEqual([]);
  });

  it("loses the samples and the ascent vehicle if Mars ascent fails, leaving the orbiter waiting", () => {
    const { simulation, program } = ready(["test-ascent"]);
    const { program: next, summary } = simulation.runTurn(program, sendHome);
    expect(summary.samplesHome).toEqual([]);
    expect(summary.sampleJourney).toEqual({
      siteName: "Alpha Plain",
      samples: 15,
      failure: { missionEventName: "Test ascent", publicSupportLost: 15 },
      stayed: false,
    });
    expect(summary.scienceGained).toBe(0);
    expect(kindsOperating(simulation, next)).toEqual([
      "rover",
      "return-orbiter",
    ]);
    expect(samplesAtAlpha(simulation, next)).toBe(20);
  });

  it("loses the samples and the orbiter if trans-Earth injection fails", () => {
    const { simulation, program } = ready(["test-departure-home"]);
    const {
      program: next,
      timeline,
      summary,
    } = simulation.runTurn(program, sendHome);
    expect(summary.sampleJourney?.failure?.missionEventName).toBe(
      "Test departure home",
    );
    expect(kindsOperating(simulation, next)).toEqual(["rover"]);
    const failed = timeline.entries.find(
      ({ title }) => title === "Test departure home failed",
    );
    expect(failed?.description).toContain(
      "Lost with the Mission: Test Return Orbiter, 15 samples from Alpha Plain.",
    );
  });

  it("offers Mars ascent's Contingency, bought at launch, whose rescue brings the samples home", () => {
    const { simulation, program } = ready(
      ["test-ascent"],
      everything(["test-ascent-restart"]),
    );
    const stopped = simulation.workOutTurn(program, sendHome);
    expect(stopped.decisionPoint).toMatchObject({
      kind: "contingency",
      day: 100,
      assets: ["Test Lifter", "15 samples from Alpha Plain"],
    });
    const { summary } = simulation.runTurn(program, sendHome, {
      [stopped.decisionPoint?.id ?? ""]: "use",
    });
    expect(summary.samplesHome[0]?.samples).toBe(15);
  });

  it("keeps the Reliability and Contingencies bought at launch through saving and loading", () => {
    const { simulation, program } = ready(
      ["test-ascent"],
      everything(["test-ascent-restart"]),
    );
    const loaded = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(program))),
    );
    expect(loaded).toEqual(program);
    expect(simulation.workOutTurn(loaded, sendHome).decisionPoint?.day).toBe(
      100,
    );
  });
});

describe("samples whose ascent vehicle stops first", () => {
  /** Ready to send samples home, with an ascent vehicle certain to fail in service on the second Turn. */
  function failingLifter(seed: number) {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, startingMoneyMillions: 5000 },
        landingSites: files.landingSites.map((site) => ({
          ...site,
          landingRisk: 0,
        })),
        assets: files.assets.map((asset) =>
          asset.id === "test-ascent-vehicle"
            ? { ...asset, failureChancePerTurn: 1 }
            : asset,
        ),
      }),
    );
    const program = simulation.runTurn(simulation.startProgram(seed), {
      mission: everything(),
    }).program;
    return { simulation, program };
  }

  it("keeps the samples at their site if the ascent vehicle fails before they would leave, and flies nothing", () => {
    // On this seed, the Test Lifter fails before day 100 of the second Turn.
    const { simulation, program } = failingLifter(9);
    const {
      program: next,
      timeline,
      summary,
    } = simulation.runTurn(program, sendHome);
    expect(summary.assetsFailed).toEqual(["Test Lifter"]);
    expect(summary.sampleJourney).toEqual({
      siteName: "Alpha Plain",
      samples: 15,
      failure: null,
      stayed: true,
    });
    expect(timeline.entries.some(({ kind }) => kind === "missionEvent")).toBe(
      false,
    );
    expect(samplesAtAlpha(simulation, next)).toBe(35);
    expect(kindsOperating(simulation, next)).toEqual([
      "rover",
      "return-orbiter",
    ]);
  });
});
