import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { scienceMilestone, simulationWith } from "./scienceTestHelpers";
import { safeLandingFiles, skipTurn } from "./testHelpers";

/**
 * The Test Catalogue with safe landings, research earning one Science and half a Public Support point a day, and these
 * changes to the Test Relay, whose Benefit raises surface research by half.
 */
function relayCatalogue(
  relay: Partial<CatalogueFiles["assets"][number]> = {},
): CatalogueFiles {
  const files = safeLandingFiles();
  return {
    ...files,
    activities: files.activities.map((activity) =>
      activity.id === "test-research"
        ? {
            ...activity,
            effect: {
              kind: "research",
              sciencePerTurn: 780,
              publicSupportPerTurn: 390,
              researchKind: "test-unpaid",
              surfaceMotion: "nearby",
            },
          }
        : activity,
    ),
    assets: files.assets.map((asset) =>
      asset.id === "test-relay" ? { ...asset, ...relay } : asset,
    ),
  };
}

function relaySimulation(
  relay: Partial<CatalogueFiles["assets"][number]> = {},
): Simulation {
  return createSimulation(parseCatalogue(relayCatalogue(relay)));
}

/** A Mission with these Assets, with the lander landing at Alpha Plain and any lander or orbiter on research. */
const missionWith = (assetIds: string[]): NonNullable<TurnPlan["mission"]> => ({
  launchVehicleId: "test-heavy",
  assetIds,
  ...(assetIds.includes("test-lander") && { landingSiteId: "alpha-plain" }),
  assetChoices: Object.fromEntries(
    assetIds
      .filter((id) => id === "test-lander" || id === "test-orbiter")
      .map((id) => [id, { activityId: "test-research" }]),
  ),
});

const sending = (assetIds: string[]): TurnPlan => ({
  mission: missionWith(assetIds),
});

/** A Program with these Assets operating at Mars after their first Turn. */
function withOperating(simulation: Simulation, assetIds: string[]): Program {
  return simulation.runTurn(simulation.startProgram(42), sending(assetIds))
    .program;
}

function researchOf(
  summary: ReturnType<Simulation["runTurn"]>["summary"],
  assetName: string,
) {
  return summary.ongoingResearch.find(
    (earned) => earned.assetName === assetName,
  );
}

describe("a relay orbiter's Benefit", () => {
  it("raises the Ongoing Research of an Asset on the surface on every day it operates, whatever its Activity", () => {
    const simulation = relaySimulation();
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const { summary } = simulation.runTurn(program, skipTurn);
    // A whole Turn at one and a half Science and three quarters of a Public Support point a day.
    expect(researchOf(summary, "Test Lander")).toEqual({
      assetName: "Test Lander",
      activityName: "Test research",
      science: 1170,
      publicSupport: 585,
      days: 780,
      benefit: {
        givenBy: ["Test Relay"],
        days: 780,
        science: 390,
        publicSupport: 195,
      },
    });
    expect(summary.scienceGained).toBe(1170);
  });
});

describe("the days a relay orbiter raises", () => {
  it("earns at the usual rate before the relay orbiter arrives", () => {
    const simulation = relaySimulation();
    const program = withOperating(simulation, ["test-lander"]);
    const { summary } = simulation.runTurn(program, sending(["test-relay"]));
    // It arrives on day 200, so 200 days at one Science a day and 580 at one and a half.
    expect(researchOf(summary, "Test Lander")).toEqual(
      expect.objectContaining({
        science: 1070,
        publicSupport: 535,
        benefit: {
          givenBy: ["Test Relay"],
          days: 580,
          science: 290,
          publicSupport: 145,
        },
      }),
    );
  });

  it("stops raising on the day the relay orbiter fails partway through a Turn", () => {
    const simulation = relaySimulation({ failureChancePerTurn: 1 });
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const { summary, timeline } = simulation.runTurn(program, skipTurn);
    expect(summary.assetsFailed).toEqual(["Test Relay"]);
    const failedOn =
      timeline.entries.find(({ kind }) => kind === "assetFailed")?.day ?? 0;
    expect(failedOn).toBeGreaterThan(0);
    expect(failedOn).toBeLessThan(780);
    // Half a Science more a day until it fails, rounded up.
    expect(researchOf(summary, "Test Lander")).toEqual(
      expect.objectContaining({
        science: 780 + Math.ceil(failedOn / 2),
        benefit: expect.objectContaining({ days: failedOn }) as unknown,
      }),
    );
  });

  it("raises nothing once the relay orbiter has failed", () => {
    const simulation = relaySimulation({ failureChancePerTurn: 1 });
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const failed = simulation.runTurn(program, skipTurn).program;
    const { summary } = simulation.runTurn(failed, skipTurn);
    expect(researchOf(summary, "Test Lander")).toEqual({
      assetName: "Test Lander",
      activityName: "Test research",
      science: 780,
      publicSupport: 390,
      days: 780,
    });
  });

  it("stops raising when the relay orbiter's Service Life ends", () => {
    // It arrives on day 200 of the first Turn, so its Service Life ends on day 320 of the second.
    const simulation = relaySimulation({
      serviceLifeOptions: [{ days: 900, costMillions: 0 }],
    });
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(summary.assetsEnded).toEqual(["Test Relay"]);
    expect(researchOf(summary, "Test Lander")).toEqual(
      expect.objectContaining({
        science: 940,
        publicSupport: 470,
        benefit: {
          givenBy: ["Test Relay"],
          days: 320,
          science: 160,
          publicSupport: 80,
        },
      }),
    );
  });

  it("gives nothing more for a second relay orbiter", () => {
    const simulation = relaySimulation();
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const twoRelays = simulation.runTurn(
      program,
      sending(["test-relay"]),
    ).program;
    const { summary } = simulation.runTurn(twoRelays, skipTurn);
    expect(
      simulation
        .readProgram(twoRelays)
        .operatingAssets.filter(({ assetId }) => assetId === "test-relay"),
    ).toHaveLength(2);
    expect(researchOf(summary, "Test Lander")).toEqual(
      expect.objectContaining({ science: 1170, publicSupport: 585 }),
    );
  });

  it("doesn't raise the research of an orbiter", () => {
    const simulation = relaySimulation();
    const program = withOperating(simulation, ["test-orbiter", "test-relay"]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(researchOf(summary, "Test Orbiter")).toEqual({
      assetName: "Test Orbiter",
      activityName: "Test research",
      science: 780,
      publicSupport: 390,
      days: 780,
    });
  });
});

/** Research that earns 78 Science a Turn and pays half a million for each. */
const paidResearch = {
  kind: "research",
  sciencePerTurn: 78,
  publicSupportPerTurn: 0,
  researchKind: "test-paid",
  surfaceMotion: "nearby",
} as const;

describe("what follows from the raised rate", () => {
  it("pays the Research Grant for the raised Science", () => {
    const files = relayCatalogue();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        activities: files.activities.map((activity) =>
          activity.id === "test-research"
            ? { ...activity, effect: paidResearch }
            : activity,
        ),
      }),
    );
    const program = withOperating(simulation, ["test-lander", "test-relay"]);
    const { summary } = simulation.runTurn(program, skipTurn);
    // 117 Science, half again the usual 78, at half a million a point.
    expect(researchOf(summary, "Test Lander")?.science).toBe(117);
    expect(summary.researchGrants).toEqual([
      { name: "Test Lander", millions: 59 },
    ]);
  });

  it("reaches a Science Milestone sooner on the raised days", () => {
    const files = relayCatalogue();
    const before = withOperating(createSimulation(parseCatalogue(files)), [
      "test-lander",
      "test-relay",
    ]);
    const { simulation } = simulationWith(
      [scienceMilestone(before.science + 300)],
      undefined,
      files,
    );
    const { timeline } = simulation.runTurn(before, skipTurn);
    // 300 Science at one and a half a day takes 200 days, where it would take 300 at the usual rate.
    expect(timeline.entries.find(({ kind }) => kind === "milestone")?.day).toBe(
      200,
    );
  });
});

describe("the raised rate in Planning Mode", () => {
  const raisedResearch = {
    science: 1170,
    publicSupport: 585,
    researchGrantMillions: 0,
  };

  it("shows the raised rate for an Asset on the surface while a relay orbiter is operating", () => {
    const simulation = relaySimulation();
    const program = withOperating(simulation, [
      "test-lander",
      "test-orbiter",
      "test-relay",
    ]);
    const research = (name: string) =>
      simulation
        .readProgram(program)
        .operatingAssets.find((asset) => asset.name === name)
        ?.activities.find(({ id }) => id === "test-research");
    expect(research("Test Lander")).toEqual(
      expect.objectContaining({
        earnsPerTurn: raisedResearch,
        raisedBy: { percent: 50, givenBy: ["Test Relay"] },
      }),
    );
    expect(research("Test Orbiter")?.earnsPerTurn?.science).toBe(780);
    expect(research("Test Orbiter")).not.toHaveProperty("raisedBy");
  });

  it("shows the raised rate for a lander on a Mission with a relay orbiter, and the usual rate without one", () => {
    const simulation = relaySimulation();
    const program = simulation.startProgram(42);
    const landerResearch = (assetIds: string[]) =>
      simulation
        .previewAssets(program, missionWith(assetIds))
        .find(({ assetId }) => assetId === "test-lander")
        ?.activities.find(({ id }) => id === "test-research");
    expect(landerResearch(["test-lander", "test-relay"])).toEqual(
      expect.objectContaining({
        earnsPerTurn: raisedResearch,
        raisedBy: { percent: 50, givenBy: ["Test Relay"] },
      }),
    );
    expect(landerResearch(["test-lander"])?.earnsPerTurn?.science).toBe(780);
    expect(landerResearch(["test-lander"])).not.toHaveProperty("raisedBy");
  });

  it("describes the relay orbiter's Benefit", () => {
    const simulation = relaySimulation();
    const relay = simulation
      .readProgram(simulation.startProgram(42))
      .assets.find(({ id }) => id === "test-relay");
    expect(relay?.benefit).toBe(
      "Raises the Ongoing Research of every Asset and Crew on the surface by 50% on each day it operates at Mars, whatever its Activity. A second one adds nothing.",
    );
    expect(
      simulation
        .readProgram(simulation.startProgram(42))
        .assets.find(({ id }) => id === "test-lander")?.benefit,
    ).toBeNull();
  });
});

describe("a dust storm with a relay orbiter operating", () => {
  it("says sheltering gives up the raised rate for the storm's days", () => {
    const calm = relaySimulation();
    const program = withOperating(calm, ["test-lander", "test-relay"]);
    const files = relayCatalogue();
    const stormy = createSimulation(
      parseCatalogue({
        ...files,
        hazards: {
          ...files.hazards,
          dustStorm: {
            ...files.hazards.dustStorm,
            chancePerSitePerTurn: 1,
            minDays: 100,
            maxDays: 100,
          },
        },
      }),
    );
    const { decisionPoint } = stormy.workOutTurn(program, skipTurn);
    // A hundred days at one and a half Science and three quarters of a Public Support point a day.
    expect(decisionPoint?.choices[0].description).toContain(
      "That gives up 150 Science, 75 Public Support",
    );
  });
});
