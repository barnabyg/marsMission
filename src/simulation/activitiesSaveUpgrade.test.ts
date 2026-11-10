import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Program, type Simulation } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup, skipTurn } from "./testHelpers";

const operating = (simulation: Simulation, program: Program) =>
  simulation.readProgram(program).operatingAssets;

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
