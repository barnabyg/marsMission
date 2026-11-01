import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { setup } from "./testHelpers";

function withFailures(failing: string[], rescueFailureProbability = 1) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: failing.includes(event.id) ? 1 : 0,
      })),
      contingencies: files.contingencies.map((contingency) => ({
        ...contingency,
        rescueFailureProbability,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

const orbiter: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    trajectoryId: "test-free-return",
  },
};
const orbiterAndLander: TurnPlan = {
  mission: {
    launchVehicleId: "test-heavy",
    assetIds: ["test-orbiter", "test-lander"],
    landingSiteId: "alpha-plain",
    trajectoryId: "test-free-return",
  },
};
const insured: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    trajectoryId: "test-free-return",
    contingencyIds: ["test-reserve-fuel"],
  },
};
const decision = "contingency:test-arrival";

describe("offering Free-return", () => {
  const ids = (mission: NonNullable<TurnPlan["mission"]>) =>
    setup()
      .simulation.previewTrajectories(mission)
      .map(({ id }) => id);

  it("is only for a Mission that has the arrival burn", () => {
    expect(
      ids({ launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] }),
    ).toContain("test-free-return");
    expect(
      ids({ launchVehicleId: "test-vehicle", assetIds: ["test-lander"] }),
    ).toEqual(["test-slow", "test-fast"]);
  });

  it("is refused for a lander alone", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
        trajectoryId: "test-free-return",
      },
    });
    expect(problems.join(" ")).toContain("Test arrival");
  });

  it("costs something when nothing goes wrong", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, orbiter)).toMatchObject({
      costMillions: 550,
      capacityTonnes: 4.5,
      problems: [],
    });
    const { timeline } = simulation.runTurn(program, orbiter);
    expect(timeline.mission?.arrivalDay).toBe(220);
    expect(timeline.mission?.returnsToEarth).toBeUndefined();
  });
});

describe("a failed arrival burn on Free-return", () => {
  it("costs no Public Support and refunds the set share of the Assets on board", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary, program: next } = simulation.runTurn(program, orbiter);
    expect(summary.failure).toEqual({
      missionEventName: "Test arrival",
      assetsLost: ["Test Orbiter"],
      publicSupportLost: 0,
      returnedToEarth: true,
      // Half of the $400M orbiter, and not of the vehicle or the route.
      refundMillions: 200,
    });
    expect(summary.moneyEndMillions).toBe(2000 - 550 + 200);
    // 100, less 15%.
    expect(summary.publicSupportEnd).toBe(85);
    expect(simulation.readProgram(next).operatingAssets).toEqual([]);
  });

  it("says so in the events column, and when the Mission is back", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { timeline } = simulation.runTurn(program, orbiter);
    const failed = timeline.entries.find(
      ({ title }) => title === "Test arrival failed",
    );
    expect(failed).toMatchObject({ outcome: "failure", day: 220 });
    expect(failed?.description).toContain("swung back");
    expect(failed?.description).toContain("no Public Support");
    expect(failed?.description).toContain("$200M");
    expect(failed?.description).toContain("Test Orbiter");
    expect(timeline.entries.at(-1)).toMatchObject({
      kind: "missionReturned",
      day: 520,
    });
    expect(timeline.mission?.returnsToEarth).toEqual({
      fromDay: 220,
      backOnDay: 520,
    });
  });

  it("brings back everything not yet delivered, including a lander", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary, timeline } = simulation.runTurn(program, orbiterAndLander);
    expect(summary.failure).toMatchObject({
      assetsLost: ["Test Orbiter", "Test Lander"],
      refundMillions: 350,
    });
    expect(timeline.mission?.assets.map(({ crashed }) => crashed)).toEqual([
      false,
      false,
    ]);
    expect(summary.firstLanding).toBeNull();
  });
});

describe("a Contingency on Free-return", () => {
  it("comes first, with both answers saying what Free-return will do", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { decisionPoint } = simulation.workOutTurn(program, insured);
    expect(decisionPoint?.decline.description).toContain("no Public Support");
    expect(decisionPoint?.decline.description).toContain("$200M");
    expect(decisionPoint?.use.description).toContain("10 Public Support");
    expect(decisionPoint?.use.description).toContain("$200M");
  });

  it("leads to Free-return when it's declined, at no Public Support", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary } = simulation.runTurn(program, insured, {
      [decision]: "decline",
    });
    expect(summary.failure).toMatchObject({
      returnedToEarth: true,
      publicSupportLost: 0,
      refundMillions: 200,
    });
  });

  it("leads to Free-return when the second roll fails, with its extra Public Support", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary } = simulation.runTurn(program, insured, {
      [decision]: "use",
    });
    expect(summary.failure).toMatchObject({
      returnedToEarth: true,
      publicSupportLost: 10,
      refundMillions: 200,
    });
  });

  it("saves the Mission as usual when the second roll works", () => {
    const { simulation, program } = withFailures(["test-arrival"], 0);
    const { summary, timeline } = simulation.runTurn(program, insured, {
      [decision]: "use",
    });
    expect(summary.failure).toBeNull();
    expect(timeline.mission?.returnsToEarth).toBeUndefined();
    expect(timeline.mission?.assets[0]?.deliveredOnDay).toBe(220);
  });
});

describe("other Mission Events failing on Free-return", () => {
  it("cost what they always do", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { summary, timeline } = simulation.runTurn(program, orbiter);
    expect(summary.failure).toEqual({
      missionEventName: "Test burn",
      assetsLost: ["Test Orbiter"],
      publicSupportLost: 30,
      returnedToEarth: false,
      refundMillions: 0,
    });
    expect(timeline.mission?.returnsToEarth).toBeUndefined();
  });

  it("crash a lander as usual, with an orbiter already delivered", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const { summary, timeline } = simulation.runTurn(program, orbiterAndLander);
    expect(summary.failure).toMatchObject({
      missionEventName: "Test landing",
      assetsLost: ["Test Lander"],
      publicSupportLost: 50,
      returnedToEarth: false,
    });
    expect(timeline.mission?.assets[1]?.crashed).toBe(true);
    expect(timeline.assetsAtMars.map(({ name }) => name)).toEqual([
      "Test Orbiter",
    ]);
  });
});
