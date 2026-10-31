import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { safeLandingFiles, sendLander, sendOrbiter } from "./testHelpers";

function setup() {
  const simulation = createSimulation(parseCatalogue(safeLandingFiles()));
  return { simulation, program: simulation.startProgram(42) };
}

/** Sets the landing risk of the two sites known from the start. */
function withRisks(alpha: number, beta: number) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk:
          site.id === "alpha-plain"
            ? alpha
            : site.id === "beta-crater"
              ? beta
              : 0,
        surveyedLandingRisk: 0,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

const landing = (landingSiteId: string) => ({
  launchVehicleId: "test-vehicle",
  assetIds: ["test-lander"],
  landingSiteId,
});
const landAt = (landingSiteId: string): TurnPlan => ({
  mission: landing(landingSiteId),
});

describe("validating a landing", () => {
  it("offers only the Landing Sites known from the start", () => {
    const { simulation, program } = setup();
    expect(
      simulation.readProgram(program).landingSites.map(({ id }) => id),
    ).toEqual(["alpha-plain", "beta-crater"]);
  });

  it("needs a Landing Site when the Mission carries a lander", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-lander"] },
    });
    expect(problems.join(" ")).toMatch(/must choose a Landing Site/);
  });

  it.each(["nowhere", "gamma-basin"])(
    "refuses a Landing Site that isn't known: %s",
    (siteId) => {
      const { simulation, program } = setup();
      const { problems } = simulation.validatePlan(program, landAt(siteId));
      expect(problems.join(" ")).toContain(siteId);
    },
  );

  it("refuses a Landing Site on a Mission with no lander", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        landingSiteId: "alpha-plain",
      },
    });
    expect(problems.join(" ")).toMatch(/Only a Mission carrying a lander/);
  });

  it("accepts a known Landing Site", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendLander).problems).toEqual([]);
  });
});

describe("the risk of a landing", () => {
  function landingEvent(alpha: number, beta: number, siteId: string) {
    const { simulation, program } = withRisks(alpha, beta);
    const event = simulation
      .previewMission(program, landing(siteId))
      .find(({ eventId }) => eventId === "test-landing");
    if (!event) throw new Error("Expected a landing");
    return event;
  }

  it("shows a Risk Band from the chosen Landing Site, for each Reliability level", () => {
    expect(landingEvent(0.8, 0.04, "alpha-plain").riskBand).toBe("Over 10%");
    const safer = landingEvent(0.8, 0.04, "beta-crater");
    expect(safer.riskBand).toBe("~5%");
    expect(safer.reliabilityLevels.map(({ riskBand }) => riskBand)).toEqual([
      "~5%",
      "~5%",
      "~1%",
    ]);
  });

  it("fails as often as the site's risk says, and never more often with more Reliability", () => {
    const { simulation } = withRisks(0.5, 0);
    let crashes = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const start = simulation.startProgram(seed);
      const plain = simulation.runTurn(start, landAt("alpha-plain"));
      const careful = simulation.runTurn(start, {
        mission: {
          ...landing("alpha-plain"),
          reliability: { "test-landing": "redundant" },
        },
      });
      if (plain.summary.failure) crashes++;
      if (careful.summary.failure) expect(plain.summary.failure).not.toBeNull();
    }
    expect(crashes).toBeGreaterThan(420);
    expect(crashes).toBeLessThan(580);
  });

  it("is certain to succeed or fail at the extremes", () => {
    const { simulation, program } = withRisks(1, 0);
    expect(
      simulation.runTurn(program, landAt("alpha-plain")).summary.failure,
    ).not.toBeNull();
    expect(
      simulation.runTurn(program, landAt("beta-crater")).summary.failure,
    ).toBeNull();
  });
});

describe("a successful landing", () => {
  it("delivers the lander a few days after arrival, operating at its site", () => {
    const { simulation, program } = setup();
    const { program: after, timeline } = simulation.runTurn(
      program,
      sendLander,
    );
    expect(simulation.readProgram(after).operatingAssets).toEqual([
      {
        assetId: "test-lander",
        name: "Test Lander",
        kind: "lander",
        arrivedOn: "2029-06-24",
        landingSiteId: "alpha-plain",
        serviceLifeDays: 50_000,
        daysLeft: 49_425,
        landingSiteName: "Alpha Plain",
      },
    ]);
    expect(timeline.assetsAtMars).toEqual([
      {
        name: "Test Lander",
        kind: "lander",
        landingSiteName: "Alpha Plain",
        fromDay: 205,
        untilDay: null,
      },
    ]);
  });

  it("earns the Milestone once, and the site's Science only the first time", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendLander);
    expect(first.summary.milestones.map(({ name }) => name)).toEqual([
      "First landing",
    ]);
    expect(first.summary.firstLanding).toEqual({
      siteName: "Alpha Plain",
      science: 50,
    });
    expect(first.summary.scienceGained).toBe(90);

    const again = simulation.runTurn(first.program, sendLander);
    expect(again.summary.milestones).toEqual([]);
    expect(again.summary.firstLanding).toBeNull();
    expect(again.summary.scienceGained).toBe(0);

    const elsewhere = simulation.runTurn(again.program, landAt("beta-crater"));
    expect(elsewhere.summary.milestones).toEqual([]);
    expect(elsewhere.summary.firstLanding?.science).toBe(80);
  });

  it("lists the landing, its Milestone and its Science in that order on the landing day", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendLander);
    const onTheDay = timeline.entries.filter((entry) => entry.day === 205);
    expect(onTheDay.map(({ title }) => title)).toEqual([
      "Test landing",
      "First landing",
      "First landing at Alpha Plain",
    ]);
    expect(onTheDay[0]?.description).toBe("Touched down at Alpha Plain.");
  });

  it("doesn't affect a Mission without a lander", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.mission?.assets[0]?.landingSiteName).toBeNull();
    expect(
      timeline.entries.some((entry) => entry.kind === "firstLanding"),
    ).toBe(false);
  });
});

describe("a failed landing", () => {
  const crash = () => {
    const { simulation, program } = withRisks(1, 1);
    return {
      simulation,
      ...simulation.runTurn(program, landAt("alpha-plain")),
    };
  };

  it("is reported as a crash at the site", () => {
    const { timeline, summary } = crash();
    const entry = timeline.entries.at(-1);
    expect(entry?.title).toBe("Test landing failed");
    expect(entry?.description).toContain("It crashed at Alpha Plain.");
    expect(summary.failure).toMatchObject({
      missionEventName: "Test landing",
      assetsLost: ["Test Lander"],
      publicSupportLost: 50,
    });
    expect(timeline.mission?.assets[0]).toMatchObject({
      lostOnDay: 205,
      crashed: true,
    });
  });

  it("earns nothing, leaves nothing operating and doesn't use up the site's Science", () => {
    const { simulation, program, summary } = crash();
    expect(summary.scienceGained).toBe(0);
    expect(summary.firstLanding).toBeNull();
    const view = simulation.readProgram(program);
    expect(view.operatingAssets).toEqual([]);
    expect(view.landingSites[0]?.landed).toBe(false);
  });
});

describe("saving a landing", () => {
  it("keeps landed Assets and sites landed at through saving and restoring", () => {
    const { simulation, program } = setup();
    const { program: after } = simulation.runTurn(program, sendLander);
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(after))),
    );
    expect(restored).toEqual(after);
    expect(simulation.readProgram(restored).landingSites[0]?.landed).toBe(true);
    expect(
      simulation.runTurn(restored, sendLander).summary.firstLanding,
    ).toBeNull();
  });

  it("gives a format 1 save's Assets a place in orbit and no sites landed at", () => {
    const { simulation } = setup();
    const restored = simulation.restoreProgram({
      formatVersion: 1,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-19",
        moneyMillions: 2000,
        publicSupport: 200,
        science: 100,
        milestoneIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [
          {
            assetId: "test-orbiter",
            name: "Test Orbiter",
            kind: "orbiter",
            arrivedOn: "2029-06-19",
          },
        ],
        status: { kind: "active" },
      },
    });
    const view = simulation.readProgram(restored);
    expect(view.operatingAssets[0]?.landingSiteName).toBeNull();
    expect(view.landingSites.every(({ landed }) => !landed)).toBe(true);
  });
});
