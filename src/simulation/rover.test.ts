import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { safeLandingFiles, sendLander } from "./testHelpers";

function setup() {
  const simulation = createSimulation(parseCatalogue(safeLandingFiles()));
  return { simulation, program: simulation.startProgram(42) };
}

/** Certain to crash at every site known from the start. */
function setupCrash() {
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
  return { simulation, program: simulation.startProgram(42) };
}

const sendRover: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-rover"],
    landingSiteId: "alpha-plain",
  },
};

/** The rover is listed first here, which mustn't change how the text reads. */
const sendRoverAndLander = (
  assetChoices?: Record<string, { activityId: string }>,
): TurnPlan => ({
  mission: {
    launchVehicleId: "test-heavy",
    assetIds: ["test-rover", "test-lander"],
    landingSiteId: "alpha-plain",
    ...(assetChoices && { assetChoices }),
  },
});

const milestoneNames = (summary: { milestones: { name: string }[] }) =>
  summary.milestones.map(({ name }) => name);

describe("planning a rover", () => {
  it("needs a Landing Site, like anything else that lands", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendRover).problems).toEqual([]);
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-rover"] },
    });
    expect(problems).toEqual([
      "A Mission that lands on Mars must choose a Landing Site.",
    ]);
  });

  it("offers its Service Lives, Reliability and Activities, starting on the first it lists", () => {
    const { simulation } = setup();
    const [rover] = simulation.previewAssets({
      launchVehicleId: "test-vehicle",
      assetIds: ["test-rover"],
    });
    expect(rover?.activityId).toBe("test-soil");
    expect(rover?.activities.map(({ earnsPerTurn }) => earnsPerTurn)).toEqual([
      { science: 78, publicSupport: 0, researchGrantMillions: 39 },
      { science: 156, publicSupport: 0, researchGrantMillions: 0 },
      null,
    ]);
    expect(rover?.serviceLifeOptions).toHaveLength(2);
    expect(rover?.reliabilityLevels).toHaveLength(3);
  });
});

describe("a rover landing", () => {
  it("earns the site's Science, its own Milestone and First landing, if nothing has landed", () => {
    const { simulation, program } = setup();
    const { summary, program: after } = simulation.runTurn(program, sendRover);
    expect(milestoneNames(summary)).toEqual(["First landing", "First rover"]);
    expect(summary.firstLanding).toEqual({
      siteName: "Alpha Plain",
      science: 50,
    });
    // 50 for the site, 40 and 20 for the Milestones, then 575 of 780 days of Test soil, rounded up.
    expect(summary.scienceGained).toBe(168);
    const [rover] = simulation.readProgram(after).operatingAssets;
    expect(rover).toMatchObject({
      name: "Test Rover",
      kind: "rover",
      landingSiteName: "Alpha Plain",
      activityName: "Test soil",
    });
  });

  it("reads correctly for a rover", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendRover);
    const landing = timeline.entries.find(
      ({ title }) => title === "Test landing",
    );
    expect(landing?.description).toBe("The rover touched down at Alpha Plain.");
    expect(timeline.assetsAtMars).toMatchObject([
      { name: "Test Rover", kind: "rover", landingSiteName: "Alpha Plain" },
    ]);
  });

  it("says when each Asset arrived, as a day of the Turn that is negative for an earlier Turn", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendRover);
    expect(first.timeline.assetsAtMars[0]).toMatchObject({
      fromDay: 205,
      arrivedOnDay: 205,
    });
    const second = simulation.runTurn(first.program, sendLander);
    // The Turn is 780 days, so the rover came down 575 days before this one started.
    expect(second.timeline.assetsAtMars).toMatchObject([
      { name: "Test Rover", fromDay: 0, arrivedOnDay: -575 },
      { name: "Test Lander", fromDay: 205, arrivedOnDay: 205 },
    ]);
  });

  it("tells the view what each Asset on the Mission is, even one that crashes", () => {
    const { simulation, program } = setupCrash();
    const { timeline } = simulation.runTurn(program, sendRover);
    expect(timeline.mission?.assets).toMatchObject([
      { name: "Test Rover", kind: "rover", crashed: true },
    ]);
  });

  it("keeps an operating Asset's key from one Turn to the next", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendRover);
    const second = simulation.runTurn(first.program, { mission: null });
    expect(first.timeline.assetsAtMars[0]?.key).toMatch(/^test-rover:/);
    expect(second.timeline.assetsAtMars[0]?.key).toBe(
      first.timeline.assetsAtMars[0]?.key,
    );
  });

  it("says how each Asset moves on the surface, which comes from its Activity", () => {
    const { simulation, program } = setup();
    const motionWith = (activityId: string) =>
      simulation.runTurn(program, {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-rover"],
          landingSiteId: "alpha-plain",
          assetChoices: { "test-rover": { activityId } },
        },
      }).timeline.assetsAtMars[0]?.surfaceMotion;
    expect(motionWith("test-soil")).toBe("nearby");
    expect(motionWith("test-traverse")).toBe("traverse");
    expect(motionWith("test-nothing")).toBe("still");
  });

  it("earns no second First landing for a lander that follows, nor the site's Science", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendRover);
    const second = simulation.runTurn(first.program, sendLander);
    expect(second.summary.milestones).toEqual([]);
    expect(second.summary.firstLanding).toBeNull();
  });

  it("earns only its own Milestone after a lander, or after an old save's First landing", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendLander);
    const second = simulation.runTurn(first.program, sendRover);
    expect(milestoneNames(second.summary)).toEqual(["First rover"]);
    expect(second.summary.firstLanding).toBeNull();

    const restored = simulation.restoreProgram({
      formatVersion: 6,
      program: {
        ...program,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
      },
    });
    expect(
      milestoneNames(simulation.runTurn(restored, sendRover).summary),
    ).toEqual(["First rover"]);
  });

  it("earns First landing but not a rover's Milestone for a lander", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendLander);
    expect(milestoneNames(summary)).toEqual(["First landing"]);
  });
});

describe("a rover's Activities", () => {
  it("earn at their different rates, and only one pays a Research Grant", () => {
    const { simulation, program } = setup();
    const landed = simulation.runTurn(program, sendRover).program;
    const key = simulation.readProgram(landed).operatingAssets[0]?.key ?? "";

    const soil = simulation.runTurn(landed, { mission: null });
    expect(soil.summary.ongoingResearch).toEqual([
      {
        assetName: "Test Rover",
        activityName: "Test soil",
        science: 78,
        publicSupport: 0,
        days: 780,
      },
    ]);
    expect(soil.summary.researchGrants).toEqual([
      { name: "Test Rover", millions: 39 },
    ]);

    const traverse = simulation.runTurn(landed, {
      mission: null,
      operatingActivities: { [key]: "test-traverse" },
    });
    expect(traverse.summary.ongoingResearch).toEqual([
      {
        assetName: "Test Rover",
        activityName: "Test traverse",
        science: 156,
        publicSupport: 0,
        days: 780,
      },
    ]);
    expect(traverse.summary.researchGrants).toEqual([]);
  });
});

describe("a rover and a lander on one Mission", () => {
  it("land at the same site in one event, each with its own Activity", () => {
    const { simulation, program } = setup();
    const {
      summary,
      timeline,
      program: after,
    } = simulation.runTurn(
      program,
      sendRoverAndLander({
        "test-rover": { activityId: "test-traverse" },
        "test-lander": { activityId: "test-research" },
      }),
    );
    expect(
      simulation
        .readProgram(after)
        .operatingAssets.map(({ name, landingSiteName, activityName }) => [
          name,
          landingSiteName,
          activityName,
        ]),
    ).toEqual([
      ["Test Rover", "Alpha Plain", "Test traverse"],
      ["Test Lander", "Alpha Plain", "Test research"],
    ]);
    const landings = timeline.entries.filter(
      ({ title }) => title === "Test landing",
    );
    expect(landings.map(({ description }) => description)).toEqual([
      "The lander and the rover touched down at Alpha Plain.",
    ]);
    expect(milestoneNames(summary)).toEqual(["First landing", "First rover"]);
    // The site's Science is paid once, however many land there.
    expect(summary.firstLanding?.science).toBe(50);
    expect(
      timeline.entries.filter(({ kind }) => kind === "firstLanding"),
    ).toHaveLength(1);
    // 575 of 780 days of 156 and of 78, rounded up.
    expect(summary.ongoingResearch.map(({ science }) => science)).toEqual([
      115, 58,
    ]);
  });

  it("are both lost in a crash, which says so once, and neither starts its Activity", () => {
    const { simulation, program } = setupCrash();
    const {
      summary,
      timeline,
      program: after,
    } = simulation.runTurn(program, sendRoverAndLander());
    expect(summary.failure?.assetsLost).toEqual(["Test Rover", "Test Lander"]);
    const failed = timeline.entries.filter(
      ({ title }) => title === "Test landing failed",
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]?.description).toContain(
      "The lander and the rover crashed at Alpha Plain. Lost with the Mission: Test Rover, Test Lander.",
    );
    expect(timeline.mission?.assets).toMatchObject([
      { name: "Test Rover", crashed: true, deliveredOnDay: null },
      { name: "Test Lander", crashed: true, deliveredOnDay: null },
    ]);
    expect(summary.scienceGained).toBe(0);
    expect(summary.milestones).toEqual([]);
    expect(summary.firstLanding).toBeNull();
    expect(summary.ongoingResearch).toEqual([]);
    expect(simulation.readProgram(after).operatingAssets).toEqual([]);
  });

  it("read correctly for a rover alone in a crash", () => {
    const { simulation, program } = setupCrash();
    const { timeline } = simulation.runTurn(program, sendRover);
    expect(timeline.entries.at(-1)?.description).toContain(
      "The rover crashed at Alpha Plain.",
    );
  });
});
