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

const orbiterDoing = (activityId: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    assetChoices: { "test-orbiter": { activityId } },
  },
});

const operating = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).operatingAssets;

/** The key of the only Asset operating, for a plan to name it by. */
function onlyKey(simulation: Simulation, program: Program): string {
  const [asset] = operating(simulation, program);
  if (!asset) throw new Error("Nothing is operating");
  return asset.key;
}

const throughStorage = (simulation: Simulation, program: Program): unknown =>
  JSON.parse(JSON.stringify(simulation.saveProgram(program)));

describe("choosing an Activity for an Asset on a Mission", () => {
  it("offers what the Asset can do, starting on the first one it lists", () => {
    const { simulation } = setup();
    const [orbiter, lander] = simulation.previewAssets({
      launchVehicleId: "test-heavy",
      assetIds: ["test-orbiter", "test-lander"],
    });
    expect(orbiter?.activityId).toBe("test-survey");
    expect(orbiter?.activities.map(({ name }) => name)).toEqual([
      "Survey",
      "Nothing",
      "Test research",
    ]);
    expect(orbiter?.activities[0]?.description).toBe("Looks for sites.");
    expect(lander?.activityId).toBe("test-nothing");
    expect(lander?.activities.map(({ name }) => name)).toEqual([
      "Nothing",
      "Test research",
    ]);
  });

  it("shows the Activity chosen", () => {
    const { simulation } = setup();
    const { mission } = orbiterDoing("test-nothing");
    if (!mission) throw new Error("The plan has a Mission");
    expect(simulation.previewAssets(mission)[0]?.activityId).toBe(
      "test-nothing",
    );
  });

  it("brings no Survey from an orbiter set to Nothing", () => {
    const { simulation, program } = setup();
    const {
      program: after,
      summary,
      timeline,
    } = simulation.runTurn(program, orbiterDoing("test-nothing"));
    expect(summary.survey).toBeNull();
    expect(timeline.entries.some(({ kind }) => kind === "survey")).toBe(false);
    expect(simulation.readProgram(after).landingSites).toHaveLength(2);
  });

  it("surveys exactly as it would by default when set to Survey", () => {
    const { simulation, program } = setup();
    expect(simulation.runTurn(program, orbiterDoing("test-survey"))).toEqual(
      simulation.runTurn(program, sendOrbiter),
    );
  });

  it("starts on the day the Asset is delivered", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(
      { ...program, moneyMillions: 10_000 },
      orbiterDoing("test-nothing"),
    );
    const second = simulation.runTurn(first.program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["gold-orbiter"],
        assetChoices: { "gold-orbiter": { activityId: "test-survey" } },
      },
    });
    expect(
      second.timeline.entries.find(({ kind }) => kind === "survey")?.day,
    ).toBe(200);
  });

  it("never starts for an Asset that is lost", () => {
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
    const { summary, program } = simulation.runTurn(
      simulation.startProgram(42),
      orbiterDoing("test-survey"),
    );
    expect(summary.survey).toBeNull();
    expect(operating(simulation, program)).toEqual([]);
  });
});

describe("the Activity of an Asset already operating", () => {
  it("stops the Survey for the Turn it is set to Nothing, and restarts it when set back", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const key = onlyKey(simulation, first.program);

    const off = simulation.runTurn(first.program, {
      mission: null,
      operatingActivities: { [key]: "test-nothing" },
    });
    expect(off.summary.survey).toBeNull();
    expect(off.timeline.assetsAtMars[0]?.activityName).toBe("Nothing");

    const on = simulation.runTurn(off.program, {
      mission: null,
      operatingActivities: { [key]: "test-survey" },
    });
    expect(on.summary.survey?.siteNameRevealed).toBe("Delta Rift");
    expect(on.timeline.assetsAtMars[0]?.activityName).toBe("Survey");
    expect(on.timeline.entries.find(({ kind }) => kind === "survey")?.day).toBe(
      0,
    );
  });

  it("can be changed on a Turn that also launches a Mission", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, orbiterDoing("test-nothing"));
    const { summary } = simulation.runTurn(first.program, {
      ...sendLander,
      operatingActivities: {
        [onlyKey(simulation, first.program)]: "test-survey",
      },
    });
    expect(summary.survey).not.toBeNull();
  });

  it("carries on into later Turns until changed", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, orbiterDoing("test-nothing"));
    expect(operating(simulation, first.program)[0]?.activityName).toBe(
      "Nothing",
    );
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.survey).toBeNull();
    const third = simulation.runTurn(second.program, {
      mission: null,
      operatingActivities: {
        [onlyKey(simulation, second.program)]: "test-survey",
      },
    });
    const fourth = simulation.runTurn(third.program, skipTurn);
    expect(operating(simulation, fourth.program)[0]?.activityName).toBe(
      "Survey",
    );
    expect(fourth.summary.survey?.siteNameRevealed).toBe("Delta Rift");
  });

  it("survives saving and restoring", () => {
    const { simulation, program } = setup();
    const { program: after } = simulation.runTurn(
      program,
      orbiterDoing("test-nothing"),
    );
    const restored = simulation.restoreProgram(
      throughStorage(simulation, after),
    );
    expect(restored).toEqual(after);
    expect(simulation.runTurn(restored, skipTurn).summary.survey).toBeNull();
  });

  it("belongs to one copy of an Asset, when two are operating", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const second = simulation.runTurn(first.program, {
      ...sendOrbiter,
      operatingActivities: {
        [onlyKey(simulation, first.program)]: "test-nothing",
      },
    });
    expect(
      operating(simulation, second.program).map(
        ({ activityName }) => activityName,
      ),
    ).toEqual(["Nothing", "Survey"]);
    expect(
      new Set(operating(simulation, second.program).map(({ key }) => key)).size,
    ).toBe(2);
  });

  it("lists what each operating Asset can do", () => {
    const { simulation, program } = setup();
    const { program: after } = simulation.runTurn(program, sendOrbiter);
    const [orbiter] = operating(simulation, after);
    expect(orbiter?.activityId).toBe("test-survey");
    expect(orbiter?.activities.map(({ id }) => id)).toEqual([
      "test-survey",
      "test-nothing",
      "test-research",
    ]);
  });

  it("needs only one surveying Asset, and a second doesn't speed it up", () => {
    const { simulation, program } = setup();
    const rich = { ...program, moneyMillions: 10_000 };
    const planWith = (gold: string): TurnPlan => ({
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "gold-orbiter"],
        assetChoices: { "gold-orbiter": { activityId: gold } },
      },
    });
    const oneSurveying = simulation.runTurn(rich, planWith("test-nothing"));
    const twoSurveying = simulation.runTurn(rich, planWith("test-survey"));
    expect(oneSurveying.summary.survey).toEqual(twoSurveying.summary.survey);
    expect(oneSurveying.summary.survey?.siteNameRevealed).toBe("Gamma Basin");
  });
});

describe("validating Activities in a plan", () => {
  it("refuses an Activity the Asset on the Mission can't do, or an unknown one", () => {
    const { simulation, program } = setup();
    const landerDoing = (activityId: string): TurnPlan => ({
      mission: {
        ...sendLander.mission,
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        assetChoices: { "test-lander": { activityId } },
      },
    });
    expect(
      simulation.validatePlan(program, landerDoing("test-survey")).problems,
    ).toEqual([`Test Lander can't do the Activity "Survey".`]);
    expect(
      simulation.validatePlan(program, landerDoing("juggling")).problems,
    ).toEqual([`There is no Activity called "juggling".`]);
    expect(() => simulation.runTurn(program, landerDoing("juggling"))).toThrow(
      /juggling/,
    );
  });

  describe("for Assets already operating, even with no Mission", () => {
    function withRelayAndOrbiter() {
      const { simulation, program } = setup();
      const { program: after } = simulation.runTurn(program, {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-relay", "test-orbiter"],
        },
      });
      const relay = operating(simulation, after).find(
        ({ assetId }) => assetId === "test-relay",
      );
      if (!relay) throw new Error("The relay isn't operating");
      return { simulation, program: after, relayKey: relay.key };
    }

    it.each([
      ["no Mission", { mission: null }],
      ["a Mission", sendOrbiter],
    ])("refuses an Activity it can't do with %s", (_, base) => {
      const { simulation, program, relayKey } = withRelayAndOrbiter();
      expect(
        simulation.validatePlan(program, {
          ...base,
          operatingActivities: { [relayKey]: "test-survey" },
        }).problems,
      ).toEqual([`Test Relay can't do the Activity "Survey".`]);
    });

    it("refuses an unknown Activity", () => {
      const { simulation, program, relayKey } = withRelayAndOrbiter();
      expect(
        simulation.validatePlan(program, {
          mission: null,
          operatingActivities: { [relayKey]: "juggling" },
        }).problems,
      ).toEqual([`There is no Activity called "juggling".`]);
    });

    it("refuses an Asset that isn't operating", () => {
      const { simulation, program } = withRelayAndOrbiter();
      const plan: TurnPlan = {
        mission: null,
        operatingActivities: { "test-relay:1999-01-01": "test-nothing" },
      };
      expect(simulation.validatePlan(program, plan).problems).toEqual([
        `There is no operating Asset called "test-relay:1999-01-01".`,
      ]);
      expect(() => simulation.runTurn(program, plan)).toThrow(/1999-01-01/);
    });
  });
});

describe("upgrading a save from before Activities", () => {
  const asset = {
    arrivedOn: "2029-06-19",
    landingSiteId: null,
    serviceLifeDays: 50_000,
    reliabilityLevelId: "none",
  };
  /** A literal copy of what format 5 looks like. Don't change this: it's a compatibility contract. */
  const formatFive = (operatingAssets: object[]) => ({
    formatVersion: 5,
    program: {
      seed: 1,
      turnNumber: 2,
      date: "2031-01-19",
      moneyMillions: 2000,
      publicSupport: 200,
      science: 100,
      milestoneIds: [],
      landedSiteIds: [],
      knownLandingSiteIds: ["alpha-plain", "beta-crater"],
      surveyedLandingSiteIds: [],
      fundingThresholdsPaid: [],
      operatingAssets,
      status: { kind: "active" },
    },
  });

  it("gives an Asset that can survey Survey, and carries on with Surveys", () => {
    const { simulation } = setup();
    const restored = simulation.restoreProgram(
      formatFive([
        {
          ...asset,
          assetId: "test-orbiter",
          name: "Test Orbiter",
          kind: "orbiter",
        },
      ]),
    );
    expect(operating(simulation, restored)[0]?.activityName).toBe("Survey");
    expect(
      simulation.runTurn(restored, skipTurn).summary.survey?.siteNameRevealed,
    ).toBe("Gamma Basin");
  });

  it("gives any other Asset Nothing", () => {
    const { simulation } = setup();
    const restored = simulation.restoreProgram(
      formatFive([
        {
          ...asset,
          assetId: "test-relay",
          name: "Test Relay",
          kind: "relay",
        },
        {
          ...asset,
          assetId: "test-lander",
          name: "Test Lander",
          kind: "lander",
          landingSiteId: "alpha-plain",
        },
      ]),
    );
    expect(
      operating(simulation, restored).map(({ activityName }) => activityName),
    ).toEqual(["Nothing", "Nothing"]);
    expect(simulation.runTurn(restored, skipTurn).summary.survey).toBeNull();
  });

  it("gives an Asset that has left the catalogue what its kind does, or Nothing", () => {
    const { simulation } = setup();
    const restored = simulation.restoreProgram(
      formatFive([
        {
          ...asset,
          assetId: "old-orbiter",
          name: "Old Orbiter",
          kind: "orbiter",
        },
        { ...asset, assetId: "old-balloon", name: "Balloon", kind: "balloon" },
      ]),
    );
    const assets = operating(simulation, restored);
    expect(assets.map(({ activityName }) => activityName)).toEqual([
      "Survey",
      "Nothing",
    ]);
    // Its choices aren't in the catalogue any more, so it stays as it is.
    expect(assets[0]?.activities).toEqual([]);
  });

  it("names an Activity that has left the catalogue as the data files name doing nothing", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        activities: files.activities.map((activity) =>
          activity.effect.kind === "nothing"
            ? { ...activity, name: "Idle" }
            : activity,
        ),
      }),
    );
    const { program } = simulation.runTurn(
      simulation.startProgram(42),
      sendOrbiter,
    );
    const gone = {
      ...program,
      operatingAssets: program.operatingAssets.map((asset) => ({
        ...asset,
        activityId: "gone",
      })),
    };
    expect(operating(simulation, gone)[0]?.activityName).toBe("Idle");
  });

  it("uses the Nothing the Asset itself lists, if the Catalogue has several", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        activities: [
          ...files.activities,
          {
            id: "test-idle",
            name: "Idle",
            description: "Does no work either.",
            effect: { kind: "nothing" },
          },
        ],
        assets: files.assets.map((design) =>
          design.id === "test-relay"
            ? { ...design, activities: ["test-idle"] }
            : design,
        ),
      }),
    );
    const restored = simulation.restoreProgram(
      formatFive([
        {
          ...asset,
          assetId: "test-relay",
          name: "Test Relay",
          kind: "relay",
        },
      ]),
    );
    expect(operating(simulation, restored)[0]?.activityId).toBe("test-idle");
  });
});
