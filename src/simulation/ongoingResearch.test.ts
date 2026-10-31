import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { safeLandingFiles, setup, skipTurn } from "./testHelpers";

const research = "test-research";

const orbiterDoing = (activityId: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    assetChoices: { "test-orbiter": { activityId } },
  },
});

const orbiterResearching = orbiterDoing(research);

/** The Test Catalogue with the orbiter's chance of failing and Service Life replaced. */
function withOrbiter(
  changes: Partial<CatalogueFiles["assets"][number]>,
  files: CatalogueFiles = testCatalogueFiles(),
): Simulation {
  return createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) =>
        asset.id === "test-orbiter" ? { ...asset, ...changes } : asset,
      ),
    }),
  );
}

/** The Test Catalogue with research earning one Science a day, so that Science counts the days. */
function oneSciencePerDay(): CatalogueFiles {
  const files = testCatalogueFiles();
  return {
    ...files,
    activities: files.activities.map((activity) =>
      activity.id === research
        ? {
            ...activity,
            effect: {
              kind: "research",
              sciencePerTurn: 780,
              publicSupportPerTurn: 0,
              researchKind: "test-unpaid",
              surfaceMotion: "nearby",
            },
          }
        : activity,
    ),
  };
}

function afterOneTurn(simulation: Simulation, plan = orbiterResearching) {
  return simulation.runTurn(simulation.startProgram(42), plan).program;
}

describe("earning Ongoing Research", () => {
  it("earns in proportion to the days from arrival to the end of the Turn", () => {
    const { simulation, program } = setup();
    const { summary, program: after } = simulation.runTurn(
      program,
      orbiterResearching,
    );
    // 580 of the Turn's 780 days, at 78 Science and 39 Public Support for a whole Turn.
    expect(summary.ongoingResearch).toEqual([
      {
        assetName: "Test Orbiter",
        activityName: "Test research",
        science: 58,
        publicSupport: 29,
        days: 580,
      },
    ]);
    // On top of the 100 Science and 200 Public Support for the first orbiter.
    expect(summary.scienceGained).toBe(158);
    expect(summary.publicSupportGained).toBe(229);
    expect(simulation.readProgram(after).science).toBe(158);
  });

  it("earns the whole rate for a whole Turn in service, and doesn't decline", () => {
    const { simulation } = setup();
    let { program } = simulation.runTurn(
      simulation.startProgram(42),
      orbiterResearching,
    );
    for (let turn = 0; turn < 3; turn++) {
      const { summary, program: next } = simulation.runTurn(program, skipTurn);
      expect(summary.ongoingResearch).toEqual([
        expect.objectContaining({ science: 78, publicSupport: 39, days: 780 }),
      ]);
      program = next;
    }
  });

  it.each([
    ["Nothing", "test-nothing"],
    ["Survey", "test-survey"],
  ])("earns nothing for an Asset set to %s", (_, activityId) => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, orbiterDoing(activityId));
    expect(summary.ongoingResearch).toEqual([]);
    expect(summary.scienceGained).toBe(100);
    expect(summary.publicSupportGained).toBe(200);
  });

  it("starts for the whole Turn when an operating Asset is switched to research", () => {
    const { simulation, program } = setup();
    const { program: after } = simulation.runTurn(
      program,
      orbiterDoing("test-survey"),
    );
    const [orbiter] = simulation.readProgram(after).operatingAssets;
    const { summary } = simulation.runTurn(after, {
      mission: null,
      operatingActivities: { [orbiter?.key ?? ""]: research },
    });
    expect(summary.ongoingResearch[0]?.days).toBe(780);
    expect(summary.survey).toBeNull();
  });

  it("rounds up for each Asset separately, so two Assets each keep a share", () => {
    const simulation = createSimulation(parseCatalogue(safeLandingFiles()));
    const { summary } = simulation.runTurn(simulation.startProgram(42), {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter", "test-lander"],
        landingSiteId: "alpha-plain",
        assetChoices: {
          "test-orbiter": { activityId: research },
          "test-lander": { activityId: research },
        },
      },
    });
    // The lander's 575 days earn 57.5 Science and 28.75 Public Support, which round up.
    expect(summary.ongoingResearch).toEqual([
      expect.objectContaining({
        assetName: "Test Orbiter",
        science: 58,
        publicSupport: 29,
        days: 580,
      }),
      expect.objectContaining({
        assetName: "Test Lander",
        science: 58,
        publicSupport: 29,
        days: 575,
      }),
    ]);
  });
});

describe("when Ongoing Research stops", () => {
  it("stops on the day an Asset fails", () => {
    const simulation = withOrbiter(
      { failureChancePerTurn: 1 },
      oneSciencePerDay(),
    );
    const { summary, timeline } = simulation.runTurn(
      afterOneTurn(simulation),
      skipTurn,
    );
    expect(summary.assetsFailed).toEqual(["Test Orbiter"]);
    const failedOn = timeline.assetsAtMars[0]?.untilDay;
    expect(failedOn).toBeLessThan(780);
    expect(summary.ongoingResearch).toEqual([
      expect.objectContaining({ science: failedOn, days: failedOn }),
    ]);
  });

  it("stops on the day an Asset's Service Life ends", () => {
    const simulation = withOrbiter({
      serviceLifeOptions: [{ days: 1000, costMillions: 0 }],
    });
    const { summary } = simulation.runTurn(afterOneTurn(simulation), skipTurn);
    // 580 of its 1000 days were in the first Turn, leaving 420.
    expect(summary.assetsEnded).toEqual(["Test Orbiter"]);
    expect(summary.ongoingResearch).toEqual([
      expect.objectContaining({ science: 42, publicSupport: 21, days: 420 }),
    ]);
  });

  it("still earns at least 1 for a single day at a low rate", () => {
    const simulation = withOrbiter({
      serviceLifeOptions: [{ days: 581, costMillions: 0 }],
    });
    const { summary } = simulation.runTurn(afterOneTurn(simulation), skipTurn);
    expect(summary.ongoingResearch).toEqual([
      expect.objectContaining({ science: 1, publicSupport: 1, days: 1 }),
    ]);
  });

  it("earns nothing when a Service Life ends as the Turn starts", () => {
    const simulation = withOrbiter({
      serviceLifeOptions: [{ days: 580, costMillions: 0 }],
    });
    const { summary } = simulation.runTurn(afterOneTurn(simulation), skipTurn);
    expect(summary.assetsEnded).toEqual(["Test Orbiter"]);
    expect(summary.ongoingResearch).toEqual([]);
    expect(summary.scienceGained).toBe(0);
  });

  it("earns nothing for an Asset lost on its Mission", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === "test-arrival" ? 1 : 0,
        })),
      }),
    );
    const { summary } = simulation.runTurn(
      simulation.startProgram(42),
      orbiterResearching,
    );
    expect(summary.failure?.assetsLost).toEqual(["Test Orbiter"]);
    expect(summary.ongoingResearch).toEqual([]);
    expect(summary.scienceGained).toBe(0);
  });

  it("still pays an Asset delivered before the Mission Event that lost another", () => {
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
    const { summary } = simulation.runTurn(simulation.startProgram(42), {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: ["test-orbiter", "test-lander"],
        landingSiteId: "alpha-plain",
        assetChoices: {
          "test-orbiter": { activityId: research },
          "test-lander": { activityId: research },
        },
      },
    });
    expect(summary.failure?.assetsLost).toEqual(["Test Lander"]);
    expect(summary.ongoingResearch.map(({ assetName }) => assetName)).toEqual([
      "Test Orbiter",
    ]);
  });
});

describe("the Public Support from Ongoing Research", () => {
  it("counts before the Public Support drain", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, orbiterResearching);
    // 100 to start with, 200 from the Milestone and 29 from research, less 15%.
    expect(summary.publicSupportEnd).toBe(279);
    expect(summary.publicSupportDrained).toBe(50);
  });

  it("keeps a Program above the Cancellation Level where nothing else adds any", () => {
    const turnsLasted = (activityId: string) => {
      const { simulation } = setup();
      let { program } = simulation.runTurn(
        simulation.startProgram(42),
        orbiterDoing(activityId),
      );
      let turns = 0;
      while (
        turns < 50 &&
        simulation.readProgram(program).status.kind === "active"
      ) {
        program = simulation.runTurn(program, skipTurn).program;
        turns++;
      }
      return { turns, simulation, program };
    };
    expect(turnsLasted("test-nothing").turns).toBeLessThan(50);
    const researching = turnsLasted(research);
    expect(researching.turns).toBe(50);
    expect(
      researching.simulation.readProgram(researching.program).publicSupport,
    ).toBeGreaterThan(50);
  });

  it("can reach a Funding Threshold by itself", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        fundingThresholds: [{ publicSupport: 340, payoutMillions: 7000 }],
      }),
    );
    // The first Turn peaks at 329. A Program at 305 goes past 340 with the 39 from research.
    const after = afterOneTurn(simulation);
    expect(simulation.readProgram(after).nextFundingThreshold).not.toBeNull();
    const { summary } = simulation.runTurn(
      { ...after, publicSupport: 305 },
      skipTurn,
    );
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 340, payoutMillions: 7000 },
    ]);
  });
});

describe("what decides the earnings", () => {
  it("gives the same earnings for the same seed and plan", () => {
    const { simulation, program } = setup();
    expect(simulation.runTurn(program, orbiterResearching)).toEqual(
      simulation.runTurn(program, orbiterResearching),
    );
  });

  it("uses no roll, so the Activity doesn't change when an Asset fails", () => {
    const simulation = withOrbiter({ failureChancePerTurn: 1 });
    const failureDay = (activityId: string) =>
      simulation.runTurn(
        afterOneTurn(simulation, orbiterDoing(activityId)),
        skipTurn,
      ).timeline.assetsAtMars[0]?.untilDay;
    expect(failureDay(research)).toBe(failureDay("test-nothing"));
  });
});

describe("what Planning Mode is told a research Activity earns", () => {
  const earnings = {
    id: research,
    name: "Test research",
    earnsPerTurn: { science: 78, publicSupport: 39 },
  };

  it("gives the whole Turn's rate for an Asset on a Mission, and none for other Activities", () => {
    const { simulation } = setup();
    const [orbiter] = simulation.previewAssets({
      launchVehicleId: "test-vehicle",
      assetIds: ["test-orbiter"],
    });
    expect(orbiter?.activities.find(({ id }) => id === research)).toMatchObject(
      earnings,
    );
    expect(
      orbiter?.activities
        .filter(({ id }) => id !== research)
        .map(({ earnsPerTurn }) => earnsPerTurn),
    ).toEqual([null, null]);
  });

  it("gives the same rate for an operating Asset, however little of the Turn it will last", () => {
    const simulation = withOrbiter({
      serviceLifeOptions: [{ days: 581, costMillions: 0 }],
    });
    const [orbiter] = simulation.readProgram(
      afterOneTurn(simulation),
    ).operatingAssets;
    expect(orbiter?.activities.find(({ id }) => id === research)).toMatchObject(
      earnings,
    );
  });

  it("gives nothing away about whether an Asset will fail this Turn", () => {
    const viewFor = (failureChancePerTurn: number) => {
      const simulation = withOrbiter({ failureChancePerTurn });
      return simulation.readProgram(afterOneTurn(simulation)).operatingAssets;
    };
    expect(viewFor(1)).toEqual(viewFor(0));
  });
});

describe("a save from before Ongoing Research", () => {
  /** A literal copy of what format 5 looks like. Don't change this: it's a compatibility contract. */
  const formatFive = {
    formatVersion: 5,
    program: {
      seed: 1,
      turnNumber: 2,
      date: "2031-01-19",
      moneyMillions: 2000,
      publicSupport: 200,
      science: 100,
      milestoneIds: [],
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
        },
      ],
      status: { kind: "active" },
    },
  };

  function restored(): { simulation: Simulation; program: Program } {
    const { simulation } = setup();
    return { simulation, program: simulation.restoreProgram(formatFive) };
  }

  it("leaves a lander doing Nothing, and earning nothing, until it is changed", () => {
    const { simulation, program } = restored();
    expect(simulation.readProgram(program).operatingAssets[0]?.activityId).toBe(
      "test-nothing",
    );
    expect(
      simulation.runTurn(program, skipTurn).summary.ongoingResearch,
    ).toEqual([]);
  });

  it("lets that lander pick research, which then earns", () => {
    const { simulation, program } = restored();
    const [lander] = simulation.readProgram(program).operatingAssets;
    expect(lander?.activities.map(({ id }) => id)).toContain(research);
    const { summary } = simulation.runTurn(program, {
      mission: null,
      operatingActivities: { [lander?.key ?? ""]: research },
    });
    expect(summary.ongoingResearch).toEqual([
      {
        assetName: "Test Lander",
        activityName: "Test research",
        science: 78,
        publicSupport: 39,
        days: 780,
      },
    ]);
  });
});
