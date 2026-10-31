import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendLander, sendOrbiter, setup, skipTurn } from "./testHelpers";

const previewLanding = (
  simulation: Simulation,
  program: Program,
  landingSiteId: string,
) =>
  simulation
    .previewMission(program, {
      launchVehicleId: "test-vehicle",
      assetIds: ["test-lander"],
      landingSiteId,
    })
    .find(({ eventId }) => eventId === "test-landing")?.riskBand;

describe("whether anything is left to Survey", () => {
  it("is true until every Landing Site has been revealed and surveyed", () => {
    const { simulation, program } = withFailures({});
    expect(simulation.readProgram(program).somethingLeftToSurvey).toBe(true);
    let current = simulation.runTurn(program, sendOrbiter).program;
    const total = testCatalogueFiles().landingSites.length;
    for (let turn = 0; turn < total; turn++) {
      current = simulation.runTurn(current, skipTurn).program;
    }
    expect(simulation.readProgram(current).somethingLeftToSurvey).toBe(false);
  });
});

const knownSites = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).landingSites.map(({ id }) => id);

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

describe("a Survey from orbit", () => {
  it("lowers the known sites' risk and reveals one more site after an orbiter arrives", () => {
    const { simulation, program } = setup();
    expect(previewLanding(simulation, program, "alpha-plain")).toBe("Over 10%");
    expect(knownSites(simulation, program)).toEqual([
      "alpha-plain",
      "beta-crater",
    ]);

    const { program: after, summary } = simulation.runTurn(
      program,
      sendOrbiter,
    );

    expect(previewLanding(simulation, after, "alpha-plain")).toBe("~1%");
    expect(previewLanding(simulation, after, "beta-crater")).toBe("~1%");
    expect(knownSites(simulation, after)).toEqual([
      "alpha-plain",
      "beta-crater",
      "gamma-basin",
    ]);
    expect(summary.survey).toEqual({
      siteNamesSurveyed: ["Alpha Plain", "Beta Crater"],
      siteNameRevealed: "Gamma Basin",
    });
  });

  it("marks which sites have been surveyed, including a site revealed by one", () => {
    const { simulation, program } = setup();
    expect(
      simulation
        .readProgram(program)
        .landingSites.map(({ surveyed }) => surveyed),
    ).toEqual([false, false]);
    const { program: after } = simulation.runTurn(program, sendOrbiter);
    expect(
      simulation
        .readProgram(after)
        .landingSites.map(({ surveyed }) => surveyed),
    ).toEqual([true, true, true]);
  });

  it("doesn't help a landing on the same Mission", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        landingSites: files.landingSites.map((site) => ({
          ...site,
          landingRisk: 1,
        })),
      }),
    );
    const { summary } = simulation.runTurn(simulation.startProgram(1), {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter", "test-lander"],
        landingSiteId: "alpha-plain",
      },
    });
    expect(summary.failure?.missionEventName).toBe("Test landing");
    expect(summary.survey?.siteNameRevealed).toBe("Gamma Basin");
  });

  it("reveals one more site each Turn until none are left, then reports nothing", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.survey).toEqual({
      siteNamesSurveyed: [],
      siteNameRevealed: "Delta Rift",
    });
    const third = simulation.runTurn(second.program, skipTurn);
    expect(third.summary.survey).toBeNull();
    expect(
      third.timeline.entries.some((entry) => entry.kind === "survey"),
    ).toBe(false);
    expect(knownSites(simulation, third.program)).toHaveLength(4);
  });

  it("gives the same result with two surveying Assets as with one", () => {
    const { simulation, program } = setup();
    const two: TurnPlan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "gold-orbiter"],
      },
    };
    const rich = { ...program, moneyMillions: 10_000 };
    const { program: withOne } = simulation.runTurn(rich, sendOrbiter);
    const { program: withTwo } = simulation.runTurn(rich, two);
    expect(knownSites(simulation, withTwo)).toEqual(
      knownSites(simulation, withOne),
    );
  });

  it("doesn't count a failed Mission, an Asset that doesn't survey or a lander", () => {
    const failing = withFailures({ "test-arrival": 1 });
    const failed = failing.simulation.runTurn(failing.program, sendOrbiter);
    expect(failed.summary.survey).toBeNull();
    expect(knownSites(failing.simulation, failed.program)).toHaveLength(2);

    const { simulation, program } = setup();
    const relay = simulation.runTurn(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
    });
    expect(relay.summary.survey).toBeNull();

    const safe = withFailures({});
    const lander = safe.simulation.runTurn(safe.program, sendLander);
    expect(lander.summary.survey).toBeNull();
    expect(knownSites(safe.simulation, lander.program)).toHaveLength(2);
  });

  it("refuses a Landing Site until a Survey has revealed it", () => {
    const { simulation, program } = setup();
    const planFor = (landingSiteId: string) => ({
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId,
      },
    });
    expect(
      simulation.validatePlan(program, planFor("gamma-basin")).problems,
    ).toHaveLength(1);
    const { program: after } = simulation.runTurn(program, sendOrbiter);
    expect(
      simulation.validatePlan(after, planFor("gamma-basin")).problems,
    ).toEqual([]);
    expect(
      simulation.validatePlan(after, planFor("delta-rift")).problems,
    ).toHaveLength(1);
  });

  it("appears in the events column on the day the orbiter arrives, or at the start if one is already there", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const arrival = first.timeline.entries.find(
      (entry) => entry.kind === "survey",
    );
    expect(arrival?.day).toBe(200);
    expect(arrival?.description).toContain("Alpha Plain, Beta Crater");
    expect(arrival?.description).toContain("Gamma Basin");

    const second = simulation.runTurn(first.program, skipTurn);
    expect(
      second.timeline.entries.find((entry) => entry.kind === "survey")?.day,
    ).toBe(0);
  });
});

describe("saving Survey progress", () => {
  it("survives saving and restoring", () => {
    const { simulation, program } = setup();
    const { program: after } = simulation.runTurn(program, sendOrbiter);
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(after))),
    );
    expect(knownSites(simulation, restored)).toEqual(
      knownSites(simulation, after),
    );
    expect(previewLanding(simulation, restored, "alpha-plain")).toBe("~1%");
  });

  const operatingOrbiter = {
    assetId: "test-orbiter",
    name: "Test Orbiter",
    kind: "orbiter",
    arrivedOn: "2029-06-19",
  };
  const olderProgram = {
    seed: 1,
    turnNumber: 2,
    date: "2031-01-19",
    moneyMillions: 2000,
    publicSupport: 200,
    science: 100,
    milestoneIds: ["first-orbiter"],
    fundingThresholdsPaid: [],
    status: { kind: "active" },
  };

  it.each([
    [
      "format 1",
      {
        formatVersion: 1,
        program: { ...olderProgram, operatingAssets: [operatingOrbiter] },
      },
    ],
    [
      "format 2",
      {
        formatVersion: 2,
        program: {
          ...olderProgram,
          landedSiteIds: [],
          operatingAssets: [{ ...operatingOrbiter, landingSiteId: null }],
        },
      },
    ],
  ])(
    "starts a %s save with the sites known from the start, and its orbiter surveys from the next Turn",
    (_, saved) => {
      const { simulation } = setup();
      const restored = simulation.restoreProgram(saved);
      expect(knownSites(simulation, restored)).toEqual([
        "alpha-plain",
        "beta-crater",
      ]);
      expect(previewLanding(simulation, restored, "alpha-plain")).toBe(
        "Over 10%",
      );
      const { summary } = simulation.runTurn(restored, skipTurn);
      expect(summary.survey?.siteNameRevealed).toBe("Gamma Basin");
    },
  );
});
