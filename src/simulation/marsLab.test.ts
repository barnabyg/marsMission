import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
  type TurnSummary,
} from "./simulation";
import { safeLandingFiles, skipTurn, steadyHealth } from "./testHelpers";

/**
 * The Test Catalogue with safe landings, money for several Missions, Crew whose Health never falls and who can do
 * paid research in either place, and a Test Lander that can do paid research too. Paid research earns 78 Science a
 * Turn and a Research Grant of 39 million for it, which the Test Lab doubles for rovers and Crew at its site.
 */
function labFiles(): CatalogueFiles {
  const files = safeLandingFiles();
  return {
    ...files,
    program: { ...files.program, startingMoneyMillions: 20_000 },
    crew: {
      ...files.crew,
      health: steadyHealth,
      orbitActivities: ["test-soil", "test-nothing"],
      surfaceActivities: ["test-soil", "test-nothing"],
    },
    assets: files.assets.map((asset) =>
      asset.id === "test-lander"
        ? { ...asset, activities: ["test-paid-research", "test-nothing"] }
        : asset,
    ),
  };
}

function labSimulation(): Simulation {
  return createSimulation(parseCatalogue(labFiles()));
}

/** A Mission with these Assets landing at this site, with a rover on Test soil. */
const landing = (
  assetIds: string[],
  landingSiteId = "alpha-plain",
): TurnPlan => ({
  mission: {
    launchVehicleId: "test-heavy",
    assetIds,
    landingSiteId,
    assetChoices: Object.fromEntries(
      assetIds
        .filter((id) => id === "test-rover")
        .map((id) => [id, { activityId: "test-soil" }]),
    ),
  },
});

/** A Crew of two doing paid research, landing at Alpha Plain or staying in Mars orbit. */
const crewOf = (landsAtSite: boolean): TurnPlan => ({
  mission: {
    launchVehicleId: "test-heavy",
    assetIds: [],
    crew: { size: 2, landsAtSite, activityId: "test-soil" },
    ...(landsAtSite && { landingSiteId: "alpha-plain" }),
  },
});

/** The Program after playing these plans in turn from a new one. */
function after(simulation: Simulation, plans: TurnPlan[]): Program {
  return plans.reduce(
    (program, plan) => simulation.runTurn(program, plan).program,
    simulation.startProgram(42),
  );
}

const grantOf = (summary: TurnSummary, name: string) =>
  summary.researchGrants.find((grant) => grant.name === name);

describe("a Mars lab's Benefit", () => {
  it("raises the Research Grant of a rover at its Landing Site on every day it operates, leaving its Science as it is", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-rover", "test-lab"])]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(grantOf(summary, "Test Rover")).toEqual({
      name: "Test Rover",
      millions: 78,
      benefit: { givenBy: ["Test Lab"], days: 780, millions: 39 },
    });
    expect(summary.researchGrantMillions).toBe(78);
    expect(
      summary.ongoingResearch.find(
        ({ assetName }) => assetName === "Test Rover",
      ),
    ).toEqual({
      assetName: "Test Rover",
      activityName: "Test soil",
      science: 78,
      publicSupport: 0,
      days: 780,
    });
    expect(summary.moneyEndMillions - summary.moneyStartMillions).toBe(
      78 + summary.baseFundingMillions - summary.upkeepMillions,
    );
  });

  it("raises it from the day the lab lands beside a rover already there", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-rover"])]);
    const { summary } = simulation.runTurn(program, landing(["test-lab"]));
    // It lands on day 205, so the rover's 78 Science come 205 days at the usual grant and 575 at twice it, 67.75
    // million.
    expect(grantOf(summary, "Test Rover")).toEqual({
      name: "Test Rover",
      millions: 68,
      benefit: { givenBy: ["Test Lab"], days: 575, millions: 29 },
    });
  });

  it("raises the Research Grants of the Crew at its Landing Site", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-lab"]), crewOf(true)]);
    const { summary } = simulation.runTurn(program, skipTurn);
    const crewGrant = summary.researchGrants.find(
      ({ name }) => name !== "Test Rover",
    );
    expect(crewGrant).toEqual({
      name: expect.stringContaining("Alpha Plain") as string,
      millions: 156,
      benefit: { givenBy: ["Test Lab"], days: 780, millions: 78 },
    });
  });

  it("raises nothing for Crew in Mars orbit or a rover at another Landing Site", () => {
    const simulation = labSimulation();
    const program = after(simulation, [
      landing(["test-rover"], "beta-crater"),
      landing(["test-lab"]),
      crewOf(false),
    ]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(summary.researchGrants).toHaveLength(2);
    for (const grant of summary.researchGrants) {
      expect(grant.benefit).toBeUndefined();
    }
    expect(grantOf(summary, "Test Rover")?.millions).toBe(39);
  });

  it("raises only the kinds of Asset it names, so not a lander's", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-lander", "test-lab"])]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(grantOf(summary, "Test Lander")).toEqual({
      name: "Test Lander",
      millions: 39,
    });
  });

  it("doesn't add up with a second lab at the same Landing Site", () => {
    const simulation = labSimulation();
    const program = after(simulation, [
      landing(["test-rover", "test-lab"]),
      landing(["test-lab"]),
    ]);
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(grantOf(summary, "Test Rover")).toEqual({
      name: "Test Rover",
      millions: 78,
      benefit: { givenBy: ["Test Lab"], days: 780, millions: 39 },
    });
  });

  it("stops once the player ends its mission", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-rover", "test-lab"])]);
    const lab = simulation
      .readProgram(program)
      .operatingAssets.find(({ assetId }) => assetId === "test-lab");
    const { summary } = simulation.runTurn(program, {
      ...skipTurn,
      endedAssetKeys: [lab?.key ?? ""],
    });
    expect(grantOf(summary, "Test Rover")).toEqual({
      name: "Test Rover",
      millions: 39,
    });
  });

  it("raises the grant for the Science a relay orbiter's Benefit has already raised", () => {
    const simulation = labSimulation();
    const program = after(simulation, [
      landing(["test-rover", "test-lab", "test-relay"]),
    ]);
    const { summary } = simulation.runTurn(program, skipTurn);
    // 117 Science, raised by half, pays 59 million, and twice that, 117 million, with the lab.
    expect(grantOf(summary, "Test Rover")).toEqual({
      name: "Test Rover",
      millions: 117,
      benefit: { givenBy: ["Test Lab"], days: 780, millions: 58 },
    });
  });
});

describe("the Mars lab's Benefit tag", () => {
  const labView = (simulation: Simulation, program: Program) =>
    simulation.readProgram(program).assets.find(({ id }) => id === "test-lab");

  it("adds nothing while no rover or Crew at a Landing Site earns a Research Grant", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-lander"])]);
    expect(labView(simulation, program)).toEqual(
      expect.objectContaining({
        benefit:
          "Raises the Research Grants of the rovers and Crew at its Landing Site by 100% on each day it operates there, whatever its Activity. A second one there adds nothing.",
        benefitImpact: null,
        grantImpact: {
          landingSiteName: null,
          assets: 0,
          crew: 0,
          extraGrantMillions: 0,
          alreadyGivenBy: [],
        },
      }),
    );
  });

  it("shows the money it would add over a whole Turn at the Landing Site where it would add most", () => {
    const simulation = labSimulation();
    const program = after(simulation, [
      landing(["test-rover"], "beta-crater"),
      crewOf(true),
    ]);
    expect(labView(simulation, program)?.grantImpact).toEqual({
      landingSiteName: "Alpha Plain",
      assets: 0,
      crew: 2,
      extraGrantMillions: 78,
      alreadyGivenBy: [],
    });
  });

  it("adds nothing where a lab already operates", () => {
    const simulation = labSimulation();
    const program = after(simulation, [landing(["test-rover", "test-lab"])]);
    expect(labView(simulation, program)?.grantImpact).toEqual({
      landingSiteName: "Alpha Plain",
      assets: 1,
      crew: 0,
      extraGrantMillions: 0,
      alreadyGivenBy: ["Test Lab"],
    });
  });

  it("isn't shown for an Asset that isn't a lab", () => {
    const simulation = labSimulation();
    const view = simulation.readProgram(simulation.startProgram(42));
    expect(
      view.assets.filter(({ grantImpact }) => grantImpact !== null),
    ).toHaveLength(1);
  });
});
