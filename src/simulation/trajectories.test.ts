import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { setup } from "./testHelpers";

const orbiter = (trajectoryId?: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-orbiter"],
    ...(trajectoryId ? { trajectoryId } : {}),
    assetChoices: { "test-orbiter": { activityId: "test-research" } },
  },
});

/** The Test Catalogue with no risk at a Landing Site. */
function safely() {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk: 0,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

const safeLander = (trajectoryId: string): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-lander"],
    landingSiteId: "alpha-plain",
    trajectoryId,
  },
});

describe("choosing a Trajectory", () => {
  it("gives a plan that names none the first one listed", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, orbiter());
    expect(timeline.mission?.arrivalDay).toBe(200);
    expect(
      simulation
        .previewTrajectories({
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
        })
        .find(({ chosen }) => chosen)?.id,
    ).toBe("test-slow");
  });

  it("adds its cost, and takes its mass from what the Launch Vehicle can carry", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, orbiter())).toMatchObject({
      costMillions: 500,
      capacityTonnes: 5,
    });
    expect(
      simulation.validatePlan(program, orbiter("test-fast")),
    ).toMatchObject({ costMillions: 600, capacityTonnes: 4, problems: [] });
  });

  it("offers each one, saying what it changes", () => {
    const { simulation } = setup();
    expect(
      simulation.previewTrajectories({
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        trajectoryId: "test-fast",
      }),
    ).toEqual([
      expect.objectContaining({
        id: "test-slow",
        transferDays: 200,
        costMillions: 0,
        capacityLossTonnes: 0,
        chosen: false,
      }),
      expect.objectContaining({
        id: "test-fast",
        transferDays: 120,
        costMillions: 100,
        capacityLossTonnes: 1,
        chosen: true,
      }),
      expect.objectContaining({ id: "test-free-return", chosen: false }),
    ]);
  });

  it("refuses one that doesn't exist", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, orbiter("nope")).problems).toEqual([
      'There is no Trajectory called "nope".',
    ]);
  });

  it("refuses a Mission that no longer fits or can no longer be afforded", () => {
    const { simulation, program } = setup();
    const heavy: TurnPlan = {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-rover"],
        landingSiteId: "alpha-plain",
        contingencyIds: ["test-thrusters"],
        trajectoryId: "test-fast",
      },
    };
    expect(
      simulation.validatePlan(program, heavy).problems.join(" "),
    ).toContain("can only carry 4 tonnes");

    const files = testCatalogueFiles();
    const poor = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, startingMoneyMillions: 550 },
      }),
    );
    const start = poor.startProgram(42);
    expect(poor.validatePlan(start, orbiter()).problems).toEqual([]);
    expect(
      poor.validatePlan(start, orbiter("test-fast")).problems[0],
    ).toContain("$600M");
  });
});

describe("arriving on a Fast Trajectory", () => {
  it("moves the Mission Events after arrival, and not those before it", () => {
    const { simulation, program } = safely();
    const { timeline } = simulation.runTurn(program, safeLander("test-fast"));
    const dayOf = (eventId: string) =>
      timeline.entries.find(
        (entry) => entry.kind === "missionEvent" && entry.eventId === eventId,
      )?.day;
    expect(timeline.mission?.arrivalDay).toBe(120);
    expect(dayOf("test-launch")).toBe(0);
    expect(dayOf("test-burn")).toBe(1);
    expect(dayOf("test-landing")).toBe(125);
    expect(timeline.mission?.assets[0]?.deliveredOnDay).toBe(125);
  });

  it("delivers on the earlier day, and leaves the Turn the same length", () => {
    const { simulation, program } = setup();
    const { timeline, program: next } = simulation.runTurn(
      program,
      orbiter("test-fast"),
    );
    expect(timeline.durationDays).toBe(780);
    expect(timeline.assetsAtMars[0]).toMatchObject({
      fromDay: 120,
      arrivedOnDay: 120,
    });
    const view = simulation.readProgram(next);
    expect(view.date).toBe("2031-01-20");
    expect(view.operatingAssets[0]?.arrivedOn).toBe("2029-03-31");
  });

  it("counts Service Life from the earlier day", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, orbiter("test-fast"));
    // Service Life is 50,000 days, and 660 of the 780 are used by the end of the Turn.
    expect(simulation.readProgram(next).operatingAssets[0]?.daysLeft).toBe(
      50_000 - 660,
    );
  });

  it("gives the Asset more days of Ongoing Research in that Turn", () => {
    const { simulation, program } = setup();
    const researched = (plan: TurnPlan) =>
      simulation.runTurn(program, plan).summary.ongoingResearch[0];
    expect(researched(orbiter())).toMatchObject({ days: 580, science: 58 });
    expect(researched(orbiter("test-fast"))).toMatchObject({
      days: 660,
      science: 66,
    });
  });

  it("gives Milestones and first landings the earlier day", () => {
    const { simulation, program } = safely();
    const { timeline } = simulation.runTurn(program, safeLander("test-fast"));
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "milestone" || kind === "firstLanding")
        .map(({ day }) => day),
    ).toEqual([125, 125]);
  });

  it("doesn't re-roll a Mission Event's outcome", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 0.3,
        })),
      }),
    );
    for (let seed = 1; seed <= 100; seed++) {
      const program = simulation.startProgram(seed);
      const failed = (plan: TurnPlan) =>
        simulation.runTurn(program, plan).summary.failure?.missionEventName;
      expect(failed(orbiter("test-fast"))).toBe(failed(orbiter()));
    }
  });

  it("puts a Decision Point on the earlier day too", () => {
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
    const { decisionPoint } = simulation.workOutTurn(
      simulation.startProgram(42),
      {
        mission: {
          launchVehicleId: "test-vehicle",
          assetIds: ["test-orbiter"],
          trajectoryId: "test-fast",
          contingencyIds: ["test-reserve-fuel"],
        },
      },
    );
    expect(decisionPoint?.day).toBe(120);
  });
});
