import { describe, expect, it } from "vitest";
import { CatalogueError, parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { skipTurn } from "./testHelpers";

/** The Test Catalogue with these Service Life options on every Asset. */
function withLives(...days: number[]) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        serviceLifeOptions: days.map((each, index) => ({
          days: each,
          costMillions: index * 100,
        })),
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

const orbiterWith = (serviceLifeDays?: number): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    ...(serviceLifeDays !== undefined && {
      assetChoices: { "test-orbiter": { serviceLifeDays } },
    }),
  },
});

describe("choosing a Service Life", () => {
  it("offers each Asset's options and adds the choice to the Mission's cost", () => {
    const { simulation, program } = withLives(1000, 2000);
    const plan = orbiterWith(2000);
    expect(
      simulation.previewAssets(plan.mission ?? orbiterWithout()),
    ).toMatchObject([
      {
        assetId: "test-orbiter",
        name: "Test Orbiter",
        serviceLifeDays: 2000,
        serviceLifeOptions: [
          { days: 1000, costMillions: 0 },
          { days: 2000, costMillions: 100 },
        ],
      },
    ]);
    expect(simulation.validatePlan(program, plan).costMillions).toBe(600);
    expect(simulation.validatePlan(program, orbiterWith()).costMillions).toBe(
      500,
    );
  });

  it("refuses a Service Life the Asset doesn't offer", () => {
    const { simulation, program } = withLives(1000, 2000);
    const { problems } = simulation.validatePlan(program, orbiterWith(1500));
    expect(problems.join(" ")).toMatch(/no Service Life of 1500 days/);
  });

  it("refuses choices for an Asset the Mission isn't carrying", () => {
    const { simulation, program } = withLives(1000);
    const { problems } = simulation.validatePlan(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        assetChoices: { "test-relay": { serviceLifeDays: 1000 } },
      },
    });
    expect(problems.join(" ")).toContain("test-relay");
  });
});

function orbiterWithout() {
  return { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] };
}

describe("a Service Life running out", () => {
  // The orbiter arrives on day 200 of Turn 1, so 1000 days takes it to day 1200: day 420 of Turn 2.
  it("stops the Asset partway through a Turn, on the right date", () => {
    const { simulation, program } = withLives(1000);
    const first = simulation.runTurn(program, orbiterWith());
    expect(
      simulation.readProgram(first.program).operatingAssets[0],
    ).toMatchObject({ serviceLifeDays: 1000, daysLeft: 420 });

    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.timeline.assetsAtMars).toEqual([
      {
        name: "Test Orbiter",
        kind: "orbiter",
        landingSiteName: null,
        activityName: "Survey",
        surfaceMotion: "still",
        arrivedOnDay: -580,
        fromDay: 0,
        untilDay: 420,
      },
    ]);
    const entry = second.timeline.entries.find(
      ({ kind }) => kind === "assetEnded",
    );
    expect(entry).toMatchObject({
      day: 420,
      title: "Test Orbiter: Service Life ended",
    });
    expect(entry?.description).toContain("costs no Public Support");
    expect(second.summary.assetsEnded).toEqual(["Test Orbiter"]);
    expect(simulation.readProgram(second.program).operatingAssets).toEqual([]);
  });

  it("costs no Public Support beyond the usual fade", () => {
    const { simulation, program } = withLives(1000);
    const first = simulation.runTurn(program, orbiterWith());
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.publicSupportEnd).toBe(
      Math.floor(first.program.publicSupport * 0.85),
    );
  });

  it("can end in the Turn the Asset arrives", () => {
    const { simulation, program } = withLives(300);
    const { timeline, summary } = simulation.runTurn(program, orbiterWith());
    expect(timeline.assetsAtMars[0]).toMatchObject({
      fromDay: 200,
      untilDay: 500,
    });
    expect(summary.assetsEnded).toEqual(["Test Orbiter"]);
  });

  it("keeps an Asset whose life ends exactly at the next Launch Window until that Turn starts", () => {
    const { simulation, program } = withLives(580);
    const first = simulation.runTurn(program, orbiterWith());
    expect(first.summary.assetsEnded).toEqual([]);
    expect(
      simulation.readProgram(first.program).operatingAssets[0]?.daysLeft,
    ).toBe(0);
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.timeline.assetsAtMars[0]?.untilDay).toBe(0);
    expect(second.summary.survey).toBeNull();
  });

  it("uses the longer option when it's chosen", () => {
    const { simulation, program } = withLives(1000, 5000);
    const first = simulation.runTurn(program, orbiterWith(5000));
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.assetsEnded).toEqual([]);
  });
});

describe("a surveying Asset's Service Life", () => {
  it("counts for a Turn it operated in, and brings no Surveys after it has ended", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        assets: files.assets.map((asset) => ({
          ...asset,
          serviceLifeOptions: [{ days: 1000, costMillions: 0 }],
        })),
        // Enough hidden sites that a Survey would always have something to find.
        landingSites: [
          ...files.landingSites,
          ...[1, 2, 3].map((number) => ({
            latitude: 0,
            longitude: 0,
            id: `extra-${number}`,
            name: `Extra ${number}`,
            description: "Extra.",
            landingRisk: 0,
            surveyedLandingRisk: 0,
            science: 1,
            knownFromStart: false,
          })),
        ],
      }),
    );
    const first = simulation.runTurn(
      simulation.startProgram(42),
      orbiterWith(),
    );
    expect(first.summary.survey).not.toBeNull();
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.survey?.siteNameRevealed).toBe("Delta Rift");
    const third = simulation.runTurn(second.program, skipTurn);
    expect(third.summary.survey).toBeNull();
  });
});

describe("Service Life in saves", () => {
  const olderProgram = {
    seed: 1,
    turnNumber: 2,
    date: "2031-01-19",
    moneyMillions: 2000,
    publicSupport: 200,
    science: 100,
    milestoneIds: [],
    landedSiteIds: [],
    knownLandingSiteIds: ["alpha-plain"],
    surveyedLandingSiteIds: [],
    fundingThresholdsPaid: [],
    status: { kind: "active" },
  };
  const format3Asset = {
    assetId: "test-orbiter",
    name: "Test Orbiter",
    kind: "orbiter",
    arrivedOn: "2029-06-19",
    landingSiteId: null,
  };

  it("keeps each Asset's Service Life", () => {
    const { simulation, program } = withLives(1000, 5000);
    const { program: after } = simulation.runTurn(program, orbiterWith(5000));
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(after))),
    );
    expect(
      simulation.readProgram(restored).operatingAssets[0]?.serviceLifeDays,
    ).toBe(5000);
  });

  it("gives an older save's Assets the shortest option, counted from their arrival", () => {
    const { simulation } = withLives(1000, 5000);
    const restored = simulation.restoreProgram({
      formatVersion: 3,
      program: { ...olderProgram, operatingAssets: [format3Asset] },
    });
    expect(simulation.readProgram(restored).operatingAssets[0]).toMatchObject({
      serviceLifeDays: 1000,
      // 579 of the 1000 days have passed between 19 June 2029 and 19 January 2031.
      daysLeft: 421,
    });
  });

  it("falls back on another Asset of the same kind if the Asset has left the catalogue", () => {
    const { simulation } = withLives(1000);
    const restored = simulation.restoreProgram({
      formatVersion: 3,
      program: {
        ...olderProgram,
        operatingAssets: [{ ...format3Asset, assetId: "retired-design" }],
      },
    });
    expect(
      simulation.readProgram(restored).operatingAssets[0]?.serviceLifeDays,
    ).toBe(1000);
  });

  it("ends an upgraded Asset whose Service Life has already passed cleanly at the start of the next Turn", () => {
    const { simulation } = withLives(100);
    const restored = simulation.restoreProgram({
      formatVersion: 3,
      program: { ...olderProgram, operatingAssets: [format3Asset] },
    });
    const view = simulation.readProgram(restored);
    expect(view.operatingAssets[0]?.daysLeft).toBe(0);

    const { summary, timeline, program } = simulation.runTurn(
      restored,
      skipTurn,
    );
    expect(summary.assetsEnded).toEqual(["Test Orbiter"]);
    expect(timeline.entries.map(({ day, kind }) => [day, kind])).toEqual([
      [0, "assetEnded"],
    ]);
    expect(summary.survey).toBeNull();
    expect(simulation.readProgram(program).operatingAssets).toEqual([]);
  });
});

describe("Service Life in the data files", () => {
  const files = testCatalogueFiles();
  const reject = (serviceLifeOptions: unknown) => () =>
    parseCatalogue({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        serviceLifeOptions,
      })),
    } as typeof files);

  it.each([
    ["no options", []],
    ["a Service Life of no days", [{ days: 0, costMillions: 0 }]],
    [
      "options out of order",
      [
        { days: 2000, costMillions: 0 },
        { days: 1000, costMillions: 10 },
      ],
    ],
    [
      "a longer option that costs less",
      [
        { days: 1000, costMillions: 50 },
        { days: 2000, costMillions: 10 },
      ],
    ],
  ])("rejects %s", (_, options) => {
    expect(reject(options)).toThrow(CatalogueError);
    expect(reject(options)).toThrow(/assets\.json/);
  });
});
