import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { setup, withFailures } from "./testHelpers";

const newLander: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-new-lander"],
    landingSiteId: "alpha-plain",
  },
};

const onPrototype: TurnPlan = {
  mission: { launchVehicleId: "test-prototype", assetIds: ["test-orbiter"] },
};

describe("Technology Readiness in Planning Mode", () => {
  it("shows each Asset and Launch Vehicle as Flight-proven, built or not built, with what it costs now", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(
      view.launchVehicles.map(({ id, technologyReadiness, costMillions }) => [
        id,
        technologyReadiness,
        costMillions,
      ]),
    ).toEqual([
      ["test-vehicle", "flight-proven", 100],
      ["test-heavy", "flight-proven", 300],
      ["test-prototype", "built", 200],
      ["test-future-vehicle", "not-built", 600],
    ]);
    expect(
      view.assets
        .filter(({ kind }) => kind === "lander")
        .map(({ id, technologyReadiness, costMillions }) => [
          id,
          technologyReadiness,
          costMillions,
        ]),
    ).toEqual([
      ["test-lander", "flight-proven", 300],
      ["test-new-lander", "built", 500],
    ]);
  });

  it("puts the higher cost of an unproven technology in the Mission's cost", () => {
    const { simulation, program } = setup();
    // 100 for the Launch Vehicle and 500 for the unproven lander.
    expect(simulation.validatePlan(program, newLander).costMillions).toBe(600);
    // 200 for the unproven Launch Vehicle and 400 for the orbiter.
    expect(simulation.validatePlan(program, onPrototype).costMillions).toBe(
      600,
    );
  });
});

/** The Test Catalogue with this failure probability for every Mission Event, and this landing risk at Alpha Plain. */
function withRisk(probability: number, landingRisk = probability) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability:
          event.failureProbability === "landingSite"
            ? "landingSite"
            : probability,
      })),
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

describe("the risk of an unproven technology", () => {
  it("raises the Risk Bands of the Mission Events a Launch Vehicle brings, with Reliability on top", () => {
    const { simulation, program } = withRisk(0.04);
    const bands = (launchVehicleId: string, reliability = {}) =>
      simulation
        .previewMission(program, {
          launchVehicleId,
          assetIds: ["test-orbiter"],
          reliability,
        })
        .map(({ eventId, riskBand }) => [eventId, riskBand]);
    expect(bands("test-vehicle")).toEqual([
      ["test-launch", "~5%"],
      ["test-burn", "~5%"],
      ["test-arrival", "~5%"],
    ]);
    expect(bands("test-prototype")).toEqual([
      ["test-launch", "~10%"],
      ["test-burn", "~10%"],
      ["test-arrival", "~5%"],
    ]);
    expect(bands("test-prototype", { "test-launch": "tested" })[0]).toEqual([
      "test-launch",
      "~5%",
    ]);
  });

  it("raises the landing of an unproven lander, which lands more safely than another lander once Flight-proven", () => {
    const { simulation, program } = withRisk(0, 0.08);
    const landingBand = (assetIds: string[]) =>
      simulation
        .previewMission(program, {
          launchVehicleId: "test-heavy",
          assetIds,
          landingSiteId: "alpha-plain",
        })
        .find(({ eventId }) => eventId === "test-landing")?.riskBand;
    expect(landingBand(["test-lander"])).toBe("~10%");
    // Half the landing risk, but twice that until it is Flight-proven.
    expect(landingBand(["test-new-lander"])).toBe("~10%");
    // A landing is as risky as the riskiest Asset in it, and still raised by the unproven lander.
    expect(landingBand(["test-rover", "test-new-lander"])).toBe("Over 10%");
  });
});

/** The Test Catalogue where every Asset has this chance of failing in service, and every landing is safe. */
function withInServiceChance(chance: number) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        failureChancePerTurn: chance,
      })),
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk: 0,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

describe("an unproven Asset in service", () => {
  it("shows a raised chance of failing in service, with Reliability on top", () => {
    const { simulation, program } = withInServiceChance(0.04);
    const [lander, newLander] = simulation.previewAssets(program, {
      launchVehicleId: "test-heavy",
      assetIds: ["test-lander", "test-new-lander"],
      landingSiteId: "alpha-plain",
    });
    expect(lander?.riskBand).toBe("~5%");
    expect(newLander?.riskBand).toBe("~10%");
    expect(
      newLander?.reliabilityLevels.map(({ riskBand }) => riskBand),
    ).toEqual(["~10%", "~5%", "~1%"]);
  });

  it("keeps the raised chance for good once delivered, while those built after it is Flight-proven don't have it", () => {
    // Twice a half chance always fails, so the first lander fails in its second Turn on every seed.
    const { simulation } = withInServiceChance(0.5);
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1);
    const failures = seeds.map((seed) => {
      const first = simulation.runTurn(
        simulation.startProgram(seed),
        newLander,
      );
      // The second lander arrives as the first fails.
      const second = simulation.runTurn(first.program, newLander);
      const third = simulation.runTurn(second.program, { mission: null });
      return [second.summary.assetsFailed, third.summary.assetsFailed];
    });
    expect(failures.map(([second]) => second)).toEqual(
      seeds.map(() => ["Test New Lander"]),
    );
    // The second lander, built Flight-proven, has only the half chance, so it survives its second Turn on some seeds.
    expect(failures.some(([, third]) => third?.length === 0)).toBe(true);
  });
});

describe("becoming Flight-proven", () => {
  it("makes an Asset Flight-proven once it is delivered, cheaper and safer from the next Turn", () => {
    const { simulation, program } = withRisk(0, 0.08);
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, newLander);
    expect(summary.technologiesProven).toEqual(["Test New Lander"]);
    // On the day of the landing that delivered it, after the landing.
    expect(
      timeline.entries
        .filter(({ day }) => day === 205)
        .map(({ kind, title }) => [kind, title]),
    ).toEqual([
      ["missionEvent", "Test landing"],
      ["milestone", "First landing"],
      ["firstLanding", "First landing at Alpha Plain"],
      ["flightProven", "Test New Lander is Flight-proven"],
    ]);

    const lander = simulation
      .readProgram(next)
      .assets.find(({ id }) => id === "test-new-lander");
    expect(lander?.technologyReadiness).toBe("flight-proven");
    expect(lander?.costMillions).toBe(300);
    expect(simulation.validatePlan(next, newLander).costMillions).toBe(400);
    if (!newLander.mission) throw new Error("Expected a Mission");
    expect(
      simulation
        .previewMission(next, newLander.mission)
        .find(({ eventId }) => eventId === "test-landing")?.riskBand,
    ).toBe("~5%");
  });

  it("leaves an Asset unproven when the Mission fails before delivering it", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, newLander);
    expect(summary.technologiesProven).toEqual([]);
    expect(timeline.entries.some(({ kind }) => kind === "flightProven")).toBe(
      false,
    );
    expect(
      simulation
        .readProgram(next)
        .assets.find(({ id }) => id === "test-new-lander")?.technologyReadiness,
    ).toBe("built");
  });

  it("makes a Launch Vehicle Flight-proven once it gets past its own Mission Events, even if the Mission fails later", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const {
      program: next,
      summary,
      timeline,
    } = simulation.runTurn(program, onPrototype);
    expect(summary.failure).not.toBeNull();
    expect(summary.technologiesProven).toEqual(["Test Prototype"]);
    expect(
      timeline.entries.find(({ kind }) => kind === "flightProven")?.day,
    ).toBe(1);
    expect(
      simulation
        .readProgram(next)
        .launchVehicles.find(({ id }) => id === "test-prototype"),
    ).toEqual(
      expect.objectContaining({
        technologyReadiness: "flight-proven",
        costMillions: 100,
      }),
    );
  });

  it("leaves a Launch Vehicle unproven when one of its own Mission Events fails", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { program: next, summary } = simulation.runTurn(program, onPrototype);
    expect(summary.technologiesProven).toEqual([]);
    expect(
      simulation
        .readProgram(next)
        .launchVehicles.find(({ id }) => id === "test-prototype")
        ?.technologyReadiness,
    ).toBe("built");
  });

  it("says nothing of a technology that was already Flight-proven", () => {
    const { simulation, program } = withRisk(0);
    const first = simulation.runTurn(program, newLander);
    const second = simulation.runTurn(first.program, newLander);
    expect(first.summary.technologiesProven).toEqual(["Test New Lander"]);
    expect(second.summary.technologiesProven).toEqual([]);
  });
});

describe("an unproven Asset coming home on a Free-return", () => {
  it("refunds its share of what was paid for it", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === "test-arrival" ? 1 : 0,
        })),
        assets: files.assets.map((asset) =>
          asset.id === "test-orbiter"
            ? {
                ...asset,
                technologyReadiness: "built" as const,
                unproven: { costMillions: 600, failureMultiplier: 2 },
              }
            : asset,
        ),
      }),
    );
    const { summary } = simulation.runTurn(simulation.startProgram(42), {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        trajectoryId: "test-free-return",
      },
    });
    // Half of the 600 it cost unproven.
    expect(summary.failure?.refundMillions).toBe(300);
    expect(summary.technologiesProven).toEqual([]);
  });
});

describe("saving which technologies are Flight-proven", () => {
  it("keeps Flight-proven status and an Asset that flew unproven through saving and loading", () => {
    const { simulation, program } = withRisk(0);
    const { program: next } = simulation.runTurn(program, newLander);
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(next))),
    );
    expect(restored).toEqual(next);
    const view = simulation.readProgram(restored);
    expect(
      view.assets.find(({ id }) => id === "test-new-lander")
        ?.technologyReadiness,
    ).toBe("flight-proven");
    expect(view.operatingAssets[0]?.flewUnproven).toBe(true);
  });

  it("upgrades a save from before Technology Readiness with everything it holds Flight-proven, and the new technology unproven", () => {
    const { simulation } = withInServiceChance(0.5);
    // A literal copy of what format 6 looks like. Don't change this: it's a compatibility contract.
    const formatSix = {
      formatVersion: 6,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-19",
        moneyMillions: 2000,
        publicSupport: 200,
        science: 100,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [
          {
            assetId: "test-lander",
            name: "Test Lander",
            kind: "lander",
            arrivedOn: "2029-06-24",
            landingSiteId: "alpha-plain",
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-research",
          },
        ],
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatSix);
    const view = simulation.readProgram(restored);
    expect(
      view.operatingAssets.map(({ flewUnproven }) => flewUnproven),
    ).toEqual([false]);
    expect(
      [...view.launchVehicles, ...view.assets]
        .filter(({ technologyReadiness }) => technologyReadiness === "built")
        .map(({ id }) => id),
    ).toEqual(["test-prototype", "test-new-lander"]);
  });
});
