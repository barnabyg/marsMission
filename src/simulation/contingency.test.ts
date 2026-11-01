import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup } from "./testHelpers";

/** A Simulation whose named Mission Events always fail, with these changes to the Reserve fuel. */
function withFailures(
  failing: string[],
  reserveFuel: Partial<CatalogueFiles["contingencies"][number]> = {},
) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: failing.includes(event.id) ? 1 : 0,
      })),
      contingencies: files.contingencies.map((contingency) =>
        contingency.id === "test-reserve-fuel"
          ? { ...contingency, ...reserveFuel }
          : contingency,
      ),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

const insured: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    contingencyIds: ["test-reserve-fuel"],
  },
};
const arrivalDecision = "contingency:test-arrival";
const useIt = { [arrivalDecision]: "use" } as const;
const declineIt = { [arrivalDecision]: "decline" } as const;

describe("buying a Contingency", () => {
  it("adds its cost and mass to the Mission's", () => {
    const { simulation, program } = setup();
    // $100M vehicle, $400M orbiter and $50M of Reserve fuel, and 2 t and 1 t.
    expect(simulation.validatePlan(program, insured)).toMatchObject({
      costMillions: 550,
      massTonnes: 3,
      problems: [],
    });
  });

  it("is offered only for the Mission Events a Mission goes through", () => {
    const { simulation, program } = setup();
    const offered = (mission: NonNullable<TurnPlan["mission"]>) =>
      simulation
        .previewMission(program, mission)
        .flatMap(({ contingency }) => contingency?.id ?? []);
    expect(
      offered({ launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] }),
    ).toEqual(["test-spare-engine", "test-reserve-fuel"]);
    expect(
      offered({
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
      }),
    ).toEqual(["test-spare-engine", "test-thrusters"]);
  });

  it("shows what it costs and its Risk Band in the preview", () => {
    const { simulation, program } = withFailures([], {
      rescueFailureProbability: 0.1,
    });
    const events = simulation.previewMission(program, {
      launchVehicleId: "test-vehicle",
      assetIds: ["test-orbiter"],
      contingencyIds: ["test-reserve-fuel"],
    });
    expect(events.at(-1)?.contingency).toMatchObject({
      name: "Reserve fuel",
      costMillions: 50,
      massTonnes: 1,
      riskBand: "~10%",
      bought: true,
    });
    expect(events[1]?.contingency?.bought).toBe(false);
  });

  it("refuses one that doesn't exist, doesn't apply or is listed twice", () => {
    const { simulation, program } = setup();
    const problemsWith = (contingencyIds: string[]) =>
      simulation.validatePlan(program, {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
          contingencyIds,
        },
      }).problems;
    expect(problemsWith(["nope"])[0]).toContain('"nope"');
    expect(problemsWith(["test-thrusters"])[0]).toContain("Backup thrusters");
    expect(
      problemsWith(["test-reserve-fuel", "test-reserve-fuel"])[0],
    ).toContain("twice");
  });

  it("refuses a Mission it makes too heavy", () => {
    const { simulation, program } = setup();
    const heavy = simulation.validatePlan(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander", "test-orbiter"],
        landingSiteId: "alpha-plain",
        contingencyIds: ["test-thrusters"],
      },
    });
    expect(heavy.massTonnes).toBe(5.5);
    expect(heavy.problems.join(" ")).toContain("weighs 5.5 tonnes");
  });
});

describe("a Mission Event failing with a Contingency bought", () => {
  it("stops the Turn at a Decision Point on the day of that Mission Event", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { decisionPoint, timeline } = simulation.workOutTurn(
      program,
      insured,
    );
    expect(decisionPoint).toMatchObject({
      id: arrivalDecision,
      day: 200,
      missionEventName: "Test arrival",
      contingencyName: "Reserve fuel",
    });
    expect(timeline.decisionDay).toBe(200);
    expect(timeline.entries.map(({ kind, title }) => [kind, title])).toEqual([
      ["missionEvent", "Test launch"],
      ["missionEvent", "Test burn"],
      ["decisionPoint", "Test arrival: Decision Point"],
    ]);
  });

  it("doesn't say what becomes of the Assets before the answer", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { timeline } = simulation.workOutTurn(program, insured);
    expect(timeline.mission).toMatchObject({
      failedOnDay: null,
      assets: [{ deliveredOnDay: null, lostOnDay: null, crashed: false }],
    });
    expect(timeline.assetsAtMars).toEqual([]);
  });

  it("offers both choices with the Risk Band and what each costs", () => {
    const { simulation, program } = withFailures(["test-arrival"], {
      rescueFailureProbability: 0.05,
    });
    const { decisionPoint } = simulation.workOutTurn(program, insured);
    expect(decisionPoint?.use.riskBand).toBe("~5%");
    expect(decisionPoint?.use.description).toContain("50%");
    // 40 for the arrival, and 10 more for the Reserve fuel failing as well.
    expect(decisionPoint?.use.description).toContain("50 Public Support");
    expect(decisionPoint?.decline.description).toContain("40 Public Support");
    expect(decisionPoint?.decline.description).toContain("Test Orbiter");
  });

  it("can't be run to its end without an answer", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    expect(() => simulation.runTurn(program, insured)).toThrow(
      "Decision Point",
    );
  });

  it("saves the Assets with a shorter Service Life when it's used and works", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, insured, useIt);
    const view = simulation.readProgram(next);
    expect(view.operatingAssets).toMatchObject([
      { name: "Test Orbiter", serviceLifeDays: 25_000 },
    ]);
    expect(summary.failure).toBeNull();
    expect(summary.contingencies).toEqual([
      {
        missionEventName: "Test arrival",
        contingencyName: "Reserve fuel",
        answer: "use",
        rescued: true,
        assets: [{ name: "Test Orbiter", serviceLifeDays: 25_000 }],
      },
    ]);
    expect(summary.milestones.map(({ name }) => name)).toEqual([
      "First orbiter",
    ]);
    expect(timeline.decisionDay).toBeNull();
    expect(timeline.entries[3]).toMatchObject({
      kind: "missionEvent",
      eventId: "test-arrival",
      outcome: "success",
      day: 200,
    });
    expect(timeline.assetsAtMars[0]?.cutServiceLifeDays).toBe(25_000);
  });

  it("loses the Assets and costs extra Public Support when it's used and fails", () => {
    const { simulation, program } = withFailures(["test-arrival"], {
      rescueFailureProbability: 1,
    });
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, insured, useIt);
    expect(simulation.readProgram(next).operatingAssets).toEqual([]);
    expect(summary.failure).toMatchObject({
      missionEventName: "Test arrival",
      assetsLost: ["Test Orbiter"],
      publicSupportLost: 50,
    });
    expect(summary.contingencies[0]).toMatchObject({
      answer: "use",
      rescued: false,
    });
    expect(timeline.entries.at(-1)).toMatchObject({
      outcome: "failure",
      title: "Test arrival failed",
    });
    expect(timeline.mission?.failedOnDay).toBe(200);
    // 100 less 50, less 15% of that.
    expect(summary.publicSupportEnd).toBe(42);
  });

  it("takes the ordinary loss when it's declined", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary, timeline } = simulation.runTurn(
      program,
      insured,
      declineIt,
    );
    expect(summary.failure).toMatchObject({ publicSupportLost: 40 });
    expect(summary.contingencies[0]).toMatchObject({
      answer: "decline",
      rescued: false,
      assets: [],
    });
    expect(timeline.entries.at(-1)?.description).toContain(
      "It costs 40 Public Support.",
    );
  });

  it("still keeps the money spent on it", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary } = simulation.runTurn(program, insured, declineIt);
    expect(summary.moneyEndMillions).toBe(2000 - 550);
  });
});

describe("a Mission Event failing with no Contingency for it", () => {
  it("raises no Decision Point", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { decisionPoint, timeline } = simulation.workOutTurn(
      program,
      sendOrbiter,
    );
    expect(decisionPoint).toBeNull();
    expect(timeline.mission?.failedOnDay).toBe(200);
  });

  it("raises none for a Contingency on another Mission Event", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    expect(simulation.workOutTurn(program, insured).decisionPoint).toBeNull();
  });

  it("raises none when the Mission Event succeeds", () => {
    const { simulation, program } = withFailures([]);
    expect(simulation.workOutTurn(program, insured).decisionPoint).toBeNull();
  });
});

describe("answers", () => {
  /** Rolls that vary by seed, for what must stay the same between answers. */
  function chancy() {
    const files = testCatalogueFiles();
    return createSimulation(
      parseCatalogue({
        ...files,
        // So that a Program lasts long enough to have something operating.
        program: { ...files.program, cancellationLevel: 1 },
        assets: files.assets.map((asset) => ({
          ...asset,
          failureChancePerTurn: 0.5,
        })),
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === "test-arrival" ? 0.5 : 0,
        })),
        contingencies: files.contingencies.map((contingency) => ({
          ...contingency,
          rescueFailureProbability: 0.5,
        })),
      }),
    );
  }
  const seeds = Array.from({ length: 100 }, (_, index) => index + 1);

  it("give the same Program for the same seed, plan and answers", () => {
    const simulation = chancy();
    for (const seed of seeds) {
      const program = simulation.startProgram(seed);
      expect(simulation.workOutTurn(program, insured, useIt)).toEqual(
        simulation.workOutTurn(program, insured, useIt),
      );
    }
  });

  it("make the second roll come out both ways over many seeds", () => {
    const simulation = chancy();
    const outcomes = seeds.flatMap((seed) => {
      const program = simulation.startProgram(seed);
      if (!simulation.workOutTurn(program, insured).decisionPoint) return [];
      const { summary } = simulation.runTurn(program, insured, useIt);
      return [summary.contingencies[0]?.rescued];
    });
    expect(new Set(outcomes)).toEqual(new Set([true, false]));
  });

  it("don't re-roll what they have nothing to do with", () => {
    const simulation = chancy();
    for (const seed of seeds) {
      const { program } = simulation.runTurn(simulation.startProgram(seed), {
        mission: null,
      });
      const withEarlier = simulation.runTurn(program, sendOrbiter).program;
      if (!simulation.workOutTurn(withEarlier, insured).decisionPoint) continue;
      const failedInService = (answer: "use" | "decline") =>
        simulation.runTurn(withEarlier, insured, { [arrivalDecision]: answer })
          .summary.assetsFailed;
      expect(failedInService("use")).toEqual(failedInService("decline"));
    }
  });

  it("show the same Turn before the Decision Point whichever is given", () => {
    const simulation = chancy();
    for (const seed of seeds) {
      const { program } = simulation.runTurn(
        simulation.startProgram(seed),
        sendOrbiter,
      );
      const stopped = simulation.workOutTurn(program, insured);
      if (!stopped.decisionPoint) continue;
      const { day } = stopped.decisionPoint;
      const before = stopped.timeline.entries.filter(
        (entry) => entry.day < day,
      );
      const answered = simulation.runTurn(program, insured, useIt).timeline;
      expect(answered.entries.filter((entry) => entry.day < day)).toEqual(
        before,
      );
    }
  });
});
