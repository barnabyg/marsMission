import { describe, expect, it } from "vitest";
import { playProgram } from "./playProgram";
import { balanceReport } from "./report";
import { strategies } from "./strategies";
import { tutorialStrategy } from "../tutorial/tutorial";
import {
  certain,
  colossusFromTheStart,
  simulationOf,
  turns,
} from "./testHelpers";

describe("strategies that fly Crew", () => {
  const flying = strategies.filter(({ name }) => name.includes("Crew"));

  it("exist", () => {
    expect(flying.length).toBeGreaterThan(0);
  });

  it.each(flying.map((strategy) => [strategy.name, strategy] as const))(
    "%s gets Crew to Mars once it can carry them, and keeps them at research until their Health or Supplies run out, or it brings them home",
    (_, strategy) => {
      const certainly = simulationOf(certain);
      const { program, turns: played } = playProgram(
        certainly,
        strategy,
        1,
        turns,
      );
      expect(
        played.some(({ researchScience }) =>
          researchScience.some(
            ({ activityName, science }) =>
              ["Crew research", "Field research"].includes(activityName) &&
              science > 0,
          ),
        ),
      ).toBe(true);
      // With nothing able to fail, only Health, or Supplies running out, take Crew away from Mars, unless the strategy
      // brings them home.
      const { crew } = certainly.saveProgram(program).program;
      expect(crew.length).toBeGreaterThan(0);
      // The tutorial's goal stops at Crew landing at a Base, but it plays on past it and brings them home.
      const bringsHome =
        strategy.name.includes("bring them home") ||
        strategy === tutorialStrategy;
      expect(
        crew.every(
          ({ location }) =>
            location.kind === "marsOrbit" ||
            location.kind === "landingSite" ||
            (location.kind === "home" && bringsHome) ||
            (location.kind === "lost" &&
              ["health", "supplies"].includes(location.cause)),
        ),
      ).toBe(true);
      expect(crew.some(({ location }) => location.kind === "home")).toBe(
        bringsHome,
      );
      // Each Crew carries the most Protection that it can afford and that fits, unless the strategy buys none.
      expect(
        crew.some(({ protectionId }) => protectionId !== "protection-none"),
      ).toBe(!strategy.name.includes("no Protection"));
    },
  );

  it("are the only ones that fly Crew", () => {
    for (const strategy of strategies.filter(
      (each) => !flying.includes(each),
    )) {
      const certainly = simulationOf(certain);
      const { program } = playProgram(certainly, strategy, 1, turns);
      expect(certainly.readProgram(program).crew).toEqual([]);
    }
  });
});

describe("solar particle events with Crew aboard", () => {
  // One comes to most Missions on their way, as often as the longest Trajectory allows.
  const stormy = {
    ...colossusFromTheStart,
    hazards: {
      ...colossusFromTheStart.hazards,
      solarParticleEvent: {
        ...colossusFromTheStart.hazards.solarParticleEvent,
        chancePerDayInFlight: 1 / 220,
      },
    },
  };
  // One strategy that goes into safe mode and one that carries on, rather than every strategy that flies Crew, which
  // takes seconds.
  const answering = strategies.filter(({ name }) =>
    [
      "big Program: land Crew, least Supplies",
      "big Program: land Crew, carry on through radiation",
    ].includes(name),
  );

  it("are a kind of Decision Point of their own, with rows of their own in the report", () => {
    expect(answering).toHaveLength(2);
    const report = balanceReport(stormy, 5, answering);
    expect(report).toMatch(
      /Decision Points: .*solar particle event with Crew \d+\.\d/,
    );
    const rows = report
      .split("\n")
      .filter((line) => line.startsWith("solar particle event with Crew"))
      .map((line) => line.trim().split(/\s{2,}/));
    expect(rows.map(([kind, answer]) => [kind, answer])).toEqual([
      ["solar particle event with Crew", "safeMode"],
      ["solar particle event with Crew", "carryOn"],
    ]);
    for (const row of rows) expect(row).toHaveLength(7);
  });
});
