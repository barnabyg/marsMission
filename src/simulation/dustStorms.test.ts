import { describe, expect, it } from "vitest";
import { CatalogueError, parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Program, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { skipTurn } from "./testHelpers";

type StormSettings = Partial<
  ReturnType<typeof testCatalogueFiles>["hazards"]["dustStorm"]
>;

function withStorms(dustStorm: StormSettings = {}) {
  const files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: 0,
      })),
      hazards: {
        ...files.hazards,
        dustStorm: {
          ...files.hazards.dustStorm,
          chancePerSitePerTurn: 1,
          ...dustStorm,
        },
      },
    }),
  );
}

const noStorms = withStorms({ chancePerSitePerTurn: 0 });

const landerDoingResearch: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-lander"],
    landingSiteId: "alpha-plain",
    assetChoices: { "test-lander": { activityId: "test-research" } },
  },
};

const stormDecision = "dust-storm:alpha-plain";

/** A Program with a lander already operating at Alpha Plain, as Turn 2 starts. */
function landerInPlace(seed = 42): Program {
  return noStorms.runTurn(noStorms.startProgram(seed), landerDoingResearch)
    .program;
}

describe("a dust storm", () => {
  it("can't be moved by a plan", () => {
    const simulation = withStorms({ minDays: 50, maxDays: 150 });
    const start = simulation.startProgram(7);
    const stormsWith = (plan: TurnPlan) =>
      simulation.workOutTurn(start, plan, {
        [stormDecision]: "shelter",
      }).timeline.dustStorms;
    expect(stormsWith(skipTurn)).toEqual(stormsWith(landerDoingResearch));
    expect(stormsWith(skipTurn).length).toBeGreaterThan(0);
  });

  it("falls on a day and for a length that its roll chose, within the Turn", () => {
    const simulation = withStorms({ minDays: 50, maxDays: 150 });
    const lengths = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const { timeline } = simulation.runTurn(
        simulation.startProgram(seed),
        skipTurn,
      );
      for (const { fromDay, toDay } of timeline.dustStorms) {
        expect(fromDay).toBeGreaterThan(0);
        expect(toDay).toBeLessThan(timeline.durationDays);
        expect(toDay - fromDay).toBeGreaterThanOrEqual(50);
        expect(toDay - fromDay).toBeLessThanOrEqual(150);
        lengths.add(toDay - fromDay);
      }
    }
    expect(lengths.size).toBeGreaterThan(50);
  });

  it("happens as often as the chance says", () => {
    const simulation = withStorms({ chancePerSitePerTurn: 0.25 });
    let storms = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      storms += simulation.runTurn(simulation.startProgram(seed), skipTurn)
        .timeline.dustStorms.length;
    }
    // Two sites are known, so 2000 Turns have 4000 chances of a storm.
    expect(storms / 4000).toBeGreaterThan(0.22);
    expect(storms / 4000).toBeLessThan(0.28);
  });

  it("with nothing at stake is only an entry in the events column", () => {
    const simulation = withStorms();
    const progress = simulation.workOutTurn(
      simulation.startProgram(42),
      skipTurn,
    );
    expect(progress.decisionPoint).toBeNull();
    const storms = progress.timeline.entries.filter(
      (entry) => entry.kind === "hazard",
    );
    expect(storms.map(({ title }) => title).toSorted()).toEqual([
      "Dust storm over Alpha Plain",
      "Dust storm over Beta Crater",
    ]);
    expect(storms[0]?.description).toContain("Nothing is operating there");
    if (progress.decisionPoint === null) {
      expect(progress.result.summary.dustStorms).toEqual([]);
    }
  });

  it("isn't shown over a Landing Site the Program doesn't know yet", () => {
    const simulation = withStorms();
    const { timeline } = simulation.runTurn(
      simulation.startProgram(42),
      skipTurn,
    );
    expect(timeline.dustStorms.map(({ siteName }) => siteName)).not.toContain(
      "Gamma Basin",
    );
  });

  it("leaves an orbiter alone", () => {
    const sendOrbiter: TurnPlan = {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
    };
    const inOrbit = noStorms.runTurn(
      noStorms.startProgram(42),
      sendOrbiter,
    ).program;
    expect(
      withStorms().workOutTurn(inOrbit, skipTurn).decisionPoint,
    ).toBeNull();
  });
});

describe("the Decision Point for a dust storm", () => {
  it("stops the Turn, with the site, the Assets and what each choice costs", () => {
    const simulation = withStorms({ failureChance: 0.04 });
    const progress = simulation.workOutTurn(landerInPlace(), skipTurn);
    const storm = progress.timeline.dustStorms.find(
      ({ siteName }) => siteName === "Alpha Plain",
    );
    expect(progress.decisionPoint).toMatchObject({
      id: stormDecision,
      kind: "dustStorm",
      day: storm?.fromDay,
      siteName: "Alpha Plain",
      assets: ["Test Lander"],
    });
    expect(progress.timeline.decisionDay).toBe(storm?.fromDay);
    const [shelter, carryOn] = progress.decisionPoint?.choices ?? [];
    expect(shelter).toMatchObject({ answer: "shelter", riskBand: null });
    expect(shelter?.description).toContain("100 days");
    expect(shelter?.description).toContain("10 Science");
    expect(carryOn).toMatchObject({ answer: "carryOn", riskBand: "~5%" });
  });

  it("shows nothing that happens after it", () => {
    const { timeline } = withStorms().workOutTurn(landerInPlace(), skipTurn);
    const day = timeline.decisionDay ?? 0;
    expect(timeline.entries.every((entry) => entry.day <= day)).toBe(true);
    expect(timeline.dustStorms.every(({ fromDay }) => fromDay <= day)).toBe(
      true,
    );
    expect(timeline.entries.at(-1)).toMatchObject({
      kind: "decisionPoint",
      hazard: "dustStorm",
      siteName: "Alpha Plain",
    });
  });

  it("doesn't change anything if it isn't answered", () => {
    const simulation = withStorms();
    expect(() => simulation.runTurn(landerInPlace(), skipTurn)).toThrow(
      /Decision Point/,
    );
  });

  it("comes before a Mission Event's own Decision Point that happens later", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === "test-arrival" ? 1 : 0,
        })),
        hazards: {
          dustStorm: {
            ...files.hazards.dustStorm,
            chancePerSitePerTurn: 1,
          },
        },
      }),
    );
    const plan: TurnPlan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        contingencyIds: ["test-reserve-fuel"],
      },
    };
    // Look for a storm before the Mission arrives on day 200, and one after.
    let sawStormFirst = false;
    let sawContingencyFirst = false;
    for (let seed = 1; seed <= 60; seed++) {
      const inPlace = landerInPlace(seed);
      const storm = simulation.workOutTurn(inPlace, skipTurn).decisionPoint;
      const first = simulation.workOutTurn(inPlace, plan).decisionPoint;
      if ((storm?.day ?? 0) < 200) {
        expect(first?.kind).toBe("dustStorm");
        sawStormFirst = true;
      } else {
        expect(first?.kind).toBe("contingency");
        sawContingencyFirst = true;
      }
    }
    expect(sawStormFirst && sawContingencyFirst).toBe(true);
  });
});

describe("answering a dust storm", () => {
  it("sheltering removes exactly the storm's days of research", () => {
    const start = landerInPlace();
    const calm = noStorms.runTurn(start, skipTurn);
    const sheltered = withStorms().runTurn(start, skipTurn, {
      [stormDecision]: "shelter",
    });
    // 78 Science and 39 Public Support over a 780-day Turn, less a 100-day storm.
    expect(calm.summary.ongoingResearch[0]).toMatchObject({
      science: 78,
      publicSupport: 39,
      days: 780,
    });
    expect(sheltered.summary.ongoingResearch[0]).toMatchObject({
      science: 68,
      publicSupport: 34,
      days: 680,
    });
    expect(sheltered.summary.assetsFailed).toEqual([]);
    expect(sheltered.program.operatingAssets).toHaveLength(1);
    expect(sheltered.summary.dustStorms).toEqual([
      {
        siteName: "Alpha Plain",
        days: 100,
        answer: "shelter",
        assets: ["Test Lander"],
        assetsFailed: [],
      },
    ]);
  });

  it("sheltering removes those days from Research Grants too", () => {
    const paid: TurnPlan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
        assetChoices: { "test-lander": { activityId: "test-paid-research" } },
      },
    };
    const files = testCatalogueFiles();
    const allowed = (dustStorm: StormSettings) =>
      createSimulation(
        parseCatalogue({
          ...files,
          missionEvents: files.missionEvents.map((event) => ({
            ...event,
            failureProbability: 0,
          })),
          assets: files.assets.map((asset) => ({
            ...asset,
            activities: [...asset.activities, "test-paid-research"],
          })),
          hazards: {
            dustStorm: { ...files.hazards.dustStorm, ...dustStorm },
          },
        }),
      );
    const calmly = allowed({});
    const start = calmly.runTurn(calmly.startProgram(42), paid).program;
    const calm = calmly.runTurn(start, skipTurn);
    const sheltered = allowed({ chancePerSitePerTurn: 1 }).runTurn(
      start,
      skipTurn,
      { [stormDecision]: "shelter" },
    );
    expect(sheltered.summary.researchGrantMillions).toBeLessThan(
      calm.summary.researchGrantMillions,
    );
  });

  it("builds Science up only on the days an Asset is working", () => {
    const start = landerInPlace();
    const simulation = withStorms({ minDays: 300, maxDays: 300 });
    const { summary, timeline } = simulation.runTurn(start, skipTurn, {
      [stormDecision]: "shelter",
    });
    expect(summary.ongoingResearch[0]?.days).toBe(480);
    expect(timeline.dustStorms[0]?.toDay).toBeLessThan(780);
  });

  it("carrying on keeps earning when nothing goes wrong", () => {
    const start = landerInPlace();
    const carriedOn = withStorms({ failureChance: 0 }).runTurn(
      start,
      skipTurn,
      { [stormDecision]: "carryOn" },
    );
    expect(carriedOn.summary.ongoingResearch[0]).toMatchObject({
      science: 78,
      days: 780,
    });
    expect(carriedOn.program.operatingAssets).toHaveLength(1);
    expect(carriedOn.summary.dustStorms[0]).toMatchObject({
      answer: "carryOn",
      assetsFailed: [],
    });
  });

  it("carrying on can make an Asset fail from a day in the storm", () => {
    const start = landerInPlace();
    const { summary, program, timeline } = withStorms({
      failureChance: 1,
    }).runTurn(start, skipTurn, { [stormDecision]: "carryOn" });
    const storm = timeline.dustStorms.find(
      ({ siteName }) => siteName === "Alpha Plain",
    );
    const failure = timeline.entries.find(
      (entry) => entry.kind === "assetFailed",
    );
    expect(summary.assetsFailed).toEqual(["Test Lander"]);
    expect(summary.dustStorms[0]?.assetsFailed).toEqual(["Test Lander"]);
    expect(program.operatingAssets).toEqual([]);
    expect(failure?.description).toContain("dust storm");
    expect(failure?.day).toBeGreaterThanOrEqual(storm?.fromDay ?? 0);
    expect(failure?.day).toBeLessThan(storm?.toDay ?? 0);
    expect(summary.ongoingResearch[0]?.days).toBe(failure?.day);
    expect(timeline.assetsAtMars[0]?.untilDay).toBe(failure?.day);
  });

  it("gives the same result however many times it's worked out", () => {
    const start = landerInPlace();
    const simulation = withStorms({ failureChance: 0.5 });
    const answers = { [stormDecision]: "carryOn" } as const;
    expect(simulation.runTurn(start, skipTurn, answers)).toEqual(
      simulation.runTurn(start, skipTurn, answers),
    );
  });

  it("costs no Public Support of its own", () => {
    const start = landerInPlace();
    const failed = withStorms({ failureChance: 1 }).runTurn(start, skipTurn, {
      [stormDecision]: "carryOn",
    });
    expect(failed.summary.failure).toBeNull();
    expect(failed.summary.publicSupportGained).toBeGreaterThan(0);
  });
});

describe("the Catalogue's dust storm", () => {
  const parseWith = (dustStorm: StormSettings) => {
    const files = testCatalogueFiles();
    return () =>
      parseCatalogue({
        ...files,
        hazards: {
          ...files.hazards,
          dustStorm: { ...files.hazards.dustStorm, ...dustStorm },
        },
      });
  };

  it("refuses a chance that can't be one", () => {
    expect(parseWith({ chancePerSitePerTurn: 1.5 })).toThrow(CatalogueError);
    expect(parseWith({ failureChance: -0.1 })).toThrow(CatalogueError);
  });

  it("refuses lengths that are the wrong way round", () => {
    expect(parseWith({ minDays: 200, maxDays: 100 })).toThrow(/minDays/);
  });

  it("refuses a storm too long to clear within a Turn", () => {
    expect(parseWith({ minDays: 100, maxDays: 779 })).toThrow(/maxDays/);
  });
});
