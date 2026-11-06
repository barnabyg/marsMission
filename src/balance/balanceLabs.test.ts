import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { labProblems } from "./invalidLabs";
import { invalidStates } from "./invalidStates";
import { planningTools, playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, real, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);

/** A rover on Soil analysis landed at Jezero Crater, with or without a Mars lab beside it. */
function roverLanded(withLab: boolean) {
  return simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: ["trailblazer-rover", ...(withLab ? ["curie-lab"] : [])],
      landingSiteId: "jezero-crater",
      assetChoices: {
        "trailblazer-rover": { activityId: "soil-analysis" },
      },
    },
  }).program;
}

/** A rover and a Mars lab at Jezero Crater, then the Program before and after the next Turn, with its summary. */
function raisedGrant() {
  const landed = roverLanded(true);
  const { summary, program } = simulation.runTurn(landed, { mission: null });
  return {
    before: simulation.readProgram(landed),
    summary,
    after: simulation.readProgram(program),
  };
}

describe("the strategy that lands a Mars lab beside rovers", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("land a Mars lab beside rovers"),
  );
  if (!strategy) throw new Error("No strategy lands a Mars lab");

  it("lands a Mars lab first where its Benefit tag says it would add most", () => {
    const program = roverLanded(false);
    const view = simulation.readProgram(program);
    expect(
      view.assets.find(({ id }) => id === "curie-lab")?.grantImpact,
    ).toEqual(expect.objectContaining({ landingSiteName: "Jezero Crater" }));
    const plan = strategy.plan(view, planningTools(simulation, program));
    expect(plan.mission?.assetIds).toEqual(["curie-lab"]);
    expect(plan.mission?.landingSiteId).toBe("jezero-crater");
  });

  it("sends no lab while one would add nothing", () => {
    const program = roverLanded(true);
    const plan = strategy.plan(
      simulation.readProgram(program),
      planningTools(simulation, program),
    );
    expect(plan.mission?.assetIds).not.toContain("curie-lab");
  });

  it("plays whole Programs without an invalid state, and its labs raise Research Grants", () => {
    const played = [1, 2, 3, 4, 5].map((seed) =>
      playProgram(real, strategy, seed, turns),
    );
    const added = played
      .flatMap(({ turns: records }) => records)
      .reduce(
        (total, { grantsAddedByLabsMillions }) =>
          total + grantsAddedByLabsMillions,
        0,
      );
    expect(added).toBeGreaterThan(0);
  });
});

describe("the checks for invalid Mars labs", () => {
  const { before, summary, after } = raisedGrant();
  const [raised] = summary.researchGrants.filter(({ benefit }) => benefit);
  if (!raised?.benefit) throw new Error("No Research Grant was raised");
  const { benefit } = raised;
  const withRaised = (
    changes: Partial<TurnSummary["researchGrants"][number]>,
  ): TurnSummary => ({
    ...summary,
    researchGrants: [{ ...raised, ...changes }],
  });
  const noLabs = (view: ProgramView): ProgramView => ({
    ...view,
    operatingAssets: view.operatingAssets.filter(
      ({ assetId }) => assetId !== "curie-lab",
    ),
  });

  it("find nothing wrong with a rover beside a Mars lab", () => {
    expect(raised.name).toBe("Trailblazer Rover");
    expect(benefit.givenBy).toEqual(["Curie Station"]);
    expect(benefit.millions).toBeGreaterThan(0);
    expect(labProblems(before, summary, after)).toEqual([]);
    expect(invalidStates(before, summary, after)).toEqual([]);
  });

  it.each<[string, () => string[], RegExp]>([
    [
      "a negative amount added",
      () =>
        labProblems(
          before,
          withRaised({ benefit: { ...benefit, millions: -1 } }),
          after,
        ),
      /added a negative amount/,
    ],
    [
      "more added than the grant",
      () =>
        labProblems(
          before,
          withRaised({
            benefit: { ...benefit, millions: raised.millions + 1 },
          }),
          after,
        ),
      /or more than the grant/,
    ],
    [
      "a grant raised on more days than the Turn has",
      () =>
        labProblems(
          before,
          withRaised({ benefit: { ...benefit, days: 10_000 } }),
          after,
        ),
      /more days than the Turn has/,
    ],
    [
      "a grant raised by something that isn't a Mars lab",
      () =>
        labProblems(
          before,
          withRaised({ benefit: { ...benefit, givenBy: ["Courier Relay"] } }),
          after,
        ),
      /isn't a Mars lab operating at Mars/,
    ],
    [
      "a grant raised with no Mars lab at Mars",
      () => labProblems(noLabs(before), summary, noLabs(after)),
      /isn't a Mars lab operating at Mars/,
    ],
    [
      "a grant raised for something at no Landing Site with a lab",
      () =>
        labProblems(before, withRaised({ name: "Crew in Mars orbit" }), after),
      /at no Landing Site with a lab/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
