import { describe, expect, it } from "vitest";
import { planningTools, playProgram } from "./playProgram";
import { balanceReport } from "./report";
import { strategies } from "./strategies";
import { certain, files, real, simulationOf, turns } from "./testHelpers";

const relayStrategy = (name: string) => {
  const strategy = strategies.find((each) => each.name === name);
  if (!strategy) throw new Error(`Expected the strategy "${name}"`);
  return strategy;
};

describe("strategies with a relay orbiter", () => {
  it("sends the Courier Relay in place of the other orbiter when it prefers it", () => {
    const strategy = relayStrategy("steady: Courier Relay");
    const certainly = simulationOf(certain);
    const start = certainly.startProgram(1);
    const plan = strategy.plan(
      certainly.readProgram(start),
      planningTools(certainly, start),
    );
    expect(plan.mission?.assetIds).toEqual(["courier-relay-orbiter"]);
  });

  it("keeps the other orbiter for the first Survey and sends the Courier Relay beside two Assets on the surface", () => {
    const strategy = relayStrategy("steady: relay beside rovers");
    const certainly = simulationOf(certain);
    let program = certainly.startProgram(1);
    const relaysSent: number[] = [];
    for (let turn = 1; turn <= turns; turn++) {
      const view = certainly.readProgram(program);
      if (view.status.kind !== "active") break;
      const plan = strategy.plan(view, planningTools(certainly, program));
      if (turn === 1) {
        expect(plan.mission?.assetIds).toEqual(["pathfinder-orbiter"]);
      }
      if (plan.mission?.assetIds.includes("courier-relay-orbiter")) {
        relaysSent.push(
          view.operatingAssets.filter(
            ({ daysLeft, landingSiteId }) =>
              daysLeft > 0 && landingSiteId !== null,
          ).length,
        );
      }
      program = certainly.runTurn(program, plan).program;
    }
    expect(relaysSent.length).toBeGreaterThan(0);
    for (const onSurface of relaysSent) {
      expect(onSurface).toBeGreaterThanOrEqual(2);
    }
  });

  it.each([
    "steady: Courier Relay",
    "steady: relay when rich",
    "steady: relay beside rovers",
  ])("%s earns Science from its Benefit", (name) => {
    const earned = Array.from({ length: 20 }, (_, index) => index + 1)
      .flatMap(
        (seed) => playProgram(real, relayStrategy(name), seed, turns).turns,
      )
      .reduce((total, { benefitScience }) => total + benefitScience, 0);
    expect(earned).toBeGreaterThan(0);
  });

  it("reports the Science that Benefits added, and leaves it out for a strategy that earned none", () => {
    const report = balanceReport(files, 20, [
      relayStrategy("steady: Courier Relay"),
      relayStrategy("steady: Soil analysis"),
    ]);
    const lines = report
      .split("\n")
      .filter((line) =>
        line.startsWith("Science per Program from Ongoing Research"),
      );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/, of which Benefits added \d+$/);
    expect(lines[1]).not.toContain("Benefits");
  });
});
