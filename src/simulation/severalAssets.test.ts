import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { setup } from "./testHelpers";

const orbiterAndLander = {
  launchVehicleId: "test-heavy",
  assetIds: ["test-orbiter", "test-lander"],
  landingSiteId: "alpha-plain",
};
const both: TurnPlan = { mission: orbiterAndLander };

function withFailures(probabilities: Record<string, number>) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: probabilities[event.id] ?? 0,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

describe("the mass a Launch Vehicle can carry", () => {
  it("adds up the Assets and reports them against the capacity", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, both)).toEqual({
      costMillions: 1000,
      massTonnes: 5,
      capacityTonnes: 10,
      problems: [],
    });
  });

  it("accepts a Mission at exactly its capacity", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { ...orbiterAndLander, launchVehicleId: "test-vehicle" },
    });
    expect(problems).toEqual([]);
  });

  it("accepts masses that don't add up exactly in floating point", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        launchVehicles: files.launchVehicles.map((vehicle) => ({
          ...vehicle,
          capacityTonnes: 0.3,
        })),
        assets: files.assets.map((asset, index) => ({
          ...asset,
          massTonnes: index === 0 ? 0.1 : 0.2,
        })),
      }),
    );
    const { problems } = simulation.validatePlan(simulation.startProgram(1), {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "test-relay"],
      },
    });
    expect(problems).toEqual([]);
  });

  it("refuses a Mission over its capacity, with a clear reason", () => {
    const { simulation, program } = setup();
    const plan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "test-relay", "test-lander"],
        landingSiteId: "alpha-plain",
      },
    };
    const { problems } = simulation.validatePlan(program, plan);
    expect(problems).toEqual([
      "This Mission weighs 7 tonnes, but its Launch Vehicle can only carry 5 tonnes.",
    ]);
    expect(() => simulation.runTurn(program, plan)).toThrow(/7 tonnes/);
  });

  it("refuses the same Asset twice", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter", "test-orbiter"],
      },
    });
    expect(problems.join(" ")).toMatch(/same Asset twice/);
  });
});

describe("a Mission carrying several Assets", () => {
  it("combines the Mission Events they need, in the order they happen", () => {
    const { simulation, program } = setup();
    expect(
      simulation
        .previewMission(program, {
          ...orbiterAndLander,
          assetIds: ["test-lander", "test-orbiter", "test-relay"],
        })
        .map(({ eventId }) => eventId),
    ).toEqual(["test-launch", "test-burn", "test-arrival", "test-landing"]);
  });

  it("delivers each Asset on its own day, earning each Milestone on that day", () => {
    const { simulation, program } = setup();
    const { timeline, summary } = simulation.runTurn(program, both);
    expect(
      timeline.mission?.assets.map(({ name, deliveredOnDay }) => [
        name,
        deliveredOnDay,
      ]),
    ).toEqual([
      ["Test Orbiter", 200],
      ["Test Lander", 205],
    ]);
    expect(
      timeline.entries.flatMap((entry) =>
        entry.kind === "milestone" ? [[entry.title, entry.day]] : [],
      ),
    ).toEqual([
      ["First orbiter", 200],
      ["First landing", 205],
    ]);
    expect(summary.failure).toBeNull();
  });
});

describe("a Mission Event failing with several Assets aboard", () => {
  it("keeps an orbiter already delivered when the lander crashes", () => {
    const { simulation, program } = withFailures({ "test-landing": 1 });
    const result = simulation.runTurn(program, both);

    const view = simulation.readProgram(result.program);
    expect(view.operatingAssets.map(({ name }) => name)).toEqual([
      "Test Orbiter",
    ]);
    expect(result.summary.failure).toMatchObject({
      missionEventName: "Test landing",
      assetsLost: ["Test Lander"],
      publicSupportLost: 50,
    });
    expect(result.summary.milestones.map(({ name }) => name)).toEqual([
      "First orbiter",
    ]);
    expect(result.timeline.assetsAtMars.map(({ name }) => name)).toEqual([
      "Test Orbiter",
    ]);
    expect(result.timeline.mission?.assets).toMatchObject([
      { name: "Test Orbiter", deliveredOnDay: 200, lostOnDay: null },
      { name: "Test Lander", lostOnDay: 205, crashed: true },
    ]);
    const failed = result.timeline.entries.find(
      (entry) => entry.kind === "missionEvent" && entry.outcome === "failure",
    );
    expect(failed?.description).toContain(
      "Lost with the Mission: Test Lander.",
    );
    expect(failed?.description).toContain("Still safe: Test Orbiter.");
  });

  it("loses a lander that hasn't landed when orbit insertion fails, without calling it a crash", () => {
    const { simulation, program } = withFailures({ "test-arrival": 1 });
    const result = simulation.runTurn(program, both);
    expect(simulation.readProgram(result.program).operatingAssets).toEqual([]);
    expect(result.summary.failure?.assetsLost).toEqual([
      "Test Orbiter",
      "Test Lander",
    ]);
    expect(result.summary.milestones).toEqual([]);
    expect(result.timeline.mission?.assets).toMatchObject([
      { lostOnDay: 200, crashed: false },
      { lostOnDay: 200, crashed: false },
    ]);
  });

  it("loses everything on a failure before arrival", () => {
    const { simulation, program } = withFailures({ "test-launch": 1 });
    const { summary } = simulation.runTurn(program, both);
    expect(summary.failure?.assetsLost).toEqual([
      "Test Orbiter",
      "Test Lander",
    ]);
  });

  it("charges the whole Mission's cost whatever is lost", () => {
    const { simulation, program } = withFailures({ "test-landing": 1 });
    const { summary } = simulation.runTurn(program, both);
    expect(summary.missionCostMillions).toBe(1000);
  });
});
