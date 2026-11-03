import { describe, expect, it } from "vitest";
import { playProgram } from "./playProgram";
import { balanceReport } from "./report";
import type { Strategy } from "./playStyle";
import { strategies } from "./strategies";
import {
  certain,
  colossusFromTheStart,
  files,
  launchNothing,
  real,
  simulationOf,
  turns,
} from "./testHelpers";

describe("the report on Decision Points", () => {
  const sheltering = strategies.find(
    ({ name }) => name === "steady: Soil analysis",
  );
  const carryingOn = strategies.find(
    ({ name }) => name === "steady: carry on through storms",
  );
  if (!sheltering || !carryingOn) throw new Error("Expected both strategies");
  const report = balanceReport(files, 40, [sheltering, carryingOn]);

  it("says how often each kind came up, and in what share of Turns", () => {
    expect(report).toMatch(
      /Decision Points: \d+\.\d per Program \(.*dust storm \d+\.\d.*\), in \d+\.\d% of Turns/,
    );
  });

  it("shows how Programs ended up according to each answer", () => {
    const rows = report
      .split("\n")
      .filter((line) => line.startsWith("dust storm"))
      .map((line) => line.trim().split(/\s{2,}/));
    expect(rows.map((row) => row.slice(0, 3))).toEqual([
      ["dust storm", "shelter", "steady: Soil analysis"],
      ["dust storm", "carryOn", "steady: carry on through storms"],
    ]);
    for (const row of rows) expect(row).toHaveLength(7);
  });

  it("records every kind of Decision Point a Turn answered", () => {
    const decisions = Array.from({ length: 40 }, (_, index) => index + 1)
      .flatMap((seed) => playProgram(real, carryingOn, seed, turns).turns)
      .flatMap((turn) => turn.decisions);
    expect(new Set(decisions.map(({ kind }) => kind))).toEqual(
      new Set(["dustStorm", "solarParticleEvent", "goNoGo"]),
    );
    expect(
      decisions
        .filter(({ kind }) => kind === "dustStorm")
        .every(({ answer }) => answer === "carryOn"),
    ).toBe(true);
  });
});

describe("the report", () => {
  const report = balanceReport(files, 3, [launchNothing]);

  /** The cells of one row of a strategy's Turn table, with the Turn number first. */
  const turnRow = (text: string, turn: number) =>
    text
      .split("\n")
      .find((line) => line.startsWith(`${String(turn).padEnd(4)}  `))
      ?.trim()
      .split(/\s+/);

  it("gives the same bytes every time", () => {
    expect(balanceReport(files, 3, [launchNothing])).toBe(report);
    expect(balanceReport(files, 3)).toBe(balanceReport(files, 3));
  });

  it("covers a strategy with no change to anything else", () => {
    expect(report).toContain("== test: launch nothing ==");
    expect(report).toContain("seeds 1 to 3");
  });

  it("shows when a Program that launches nothing is cancelled", () => {
    expect(report).toContain("Cancelled: 100.0% of Programs, on Turn 5.0");
    expect(report).toContain(`  Turn  5 100.0% ${"#".repeat(40)}`);
    expect(report).toContain("First Mission failed: never");
    expect(turnRow(report, 4)).toEqual(
      "4 100.0 2300 0 51 0.0 0 0 0 - -".split(" "),
    );
    expect(turnRow(report, 5)).toEqual(
      "5 0.0 2300 0 43 0.0 0 0 0 - -".split(" "),
    );
    expect(turnRow(report, 6)).toBeUndefined();
  });

  it("counts a Funding Threshold's payout as income, and the Research Grant separately", () => {
    const landOnce: Strategy = {
      name: "test: land once",
      description: "Lands one lander on the first Turn.",
      plan: (view) => ({
        mission:
          view.turnNumber === 1
            ? {
                launchVehicleId: "meridian-medium",
                assetIds: ["prospector-lander"],
                landingSiteId: "jezero-crater",
              }
            : null,
      }),
    };
    const text = balanceReport(certain, 2, [landOnce]);
    // 2300 - 1100 + 1000 from the first Funding Threshold + a Research Grant of 37, with
    // 570 of 780 days at 100 Science a Turn being 73 Science, plus 150 and 120 for the landing.
    // (100 + 250 for the landing + 7 of research) less 15% is 303 Public Support.
    expect(turnRow(text, 1)).toEqual(
      "1 100.0 2237 343 303 1.0 1100 1000 37 96.4 3.6".split(" "),
    );
    expect(text).toMatch(/^250 +1000 +100\.0 +1\.0$/m);
    expect(text).toMatch(/^425 +1500 +0\.0 +-$/m);
    expect(text).toContain("Surface research");
  });

  it("says when Research Grants take over, and when they never do", () => {
    expect(report).toContain(
      "Research Grants pass Funding Thresholds: each Turn never, in total never",
    );
    const keepsARover: Strategy = {
      name: "test: one rover",
      description: "Lands one rover on the first Turn and keeps it at work.",
      plan: (view) => ({
        mission:
          view.turnNumber === 1
            ? {
                launchVehicleId: "meridian-medium",
                assetIds: ["trailblazer-rover"],
                landingSiteId: "jezero-crater",
                assetChoices: {
                  "trailblazer-rover": {
                    serviceLifeDays: 2800,
                    activityId: "soil-analysis",
                  },
                },
              }
            : null,
      }),
    };
    expect(balanceReport(certain, 2, [keepsARover])).toMatch(
      /Research Grants pass Funding Thresholds: each Turn from Turn \d+ on, in total by Turn \d+/,
    );
  });

  it("says who is cancelled with an Asset still operating", () => {
    expect(report).toContain(", 0.0% with an Asset still operating");
  });

  it("shows how Programs end up after their first Mission", () => {
    const text = balanceReport(certain, 2, [
      strategies.find(({ name }) => name === "steady: Soil analysis") ??
        launchNothing,
    ]);
    expect(text).toMatch(/First Mission worked \(100\.0%\): ends with \$\d+M/);
    expect(text).not.toContain("First Mission failed (");
  });
});

describe("the report on technology", () => {
  const named = (name: string) => {
    const strategy = strategies.find((each) => each.name === name);
    if (!strategy) throw new Error(`Expected the strategy "${name}"`);
    return strategy;
  };

  it("counts Developments started and finished, and how Programs ended by whether they started one", () => {
    const text = balanceReport(certain, 2, [
      named("steady: develop the Endurance Rover"),
    ]);
    expect(text).toMatch(
      /^steady: develop the Endurance Rover +yes +100\.0 +1\.0 +1\.0 +\d+ +\d+ +0\.0$/m,
    );
    expect(text).not.toMatch(/^steady: develop the Endurance Rover +no /m);
  });

  it("counts first flights of unproven technology, how often they failed, and how Programs ended after each", () => {
    const text = balanceReport(files, 20, [
      named("land straight away, Pinpoint Lander"),
    ]);
    const row = (pattern: string) =>
      new RegExp(
        `^land straight away, Pinpoint Lander +Pinpoint Lander +${pattern}$`,
        "m",
      );
    expect(text).toMatch(row(String.raw`100\.0 +\d+\.\d +1\.0`));
    expect(text).toMatch(row(String.raw`worked +\d+\.\d +\d+ +\d+ +\d+\.\d`));
    expect(text).toMatch(row(String.raw`failed +\d+\.\d +\d+ +\d+ +\d+\.\d`));
  });

  it("records a first flight as failed when it doesn't make the technology Flight-proven", () => {
    const flights = Array.from({ length: 20 }, (_, index) =>
      playProgram(
        real,
        named("land straight away, Pinpoint Lander"),
        index + 1,
        turns,
      ),
    ).flatMap(({ turns: played }) =>
      played.flatMap(({ unprovenFlights, missionFailed }) =>
        unprovenFlights.map(({ failed }) => ({ failed, missionFailed })),
      ),
    );
    expect(flights.some(({ failed }) => failed)).toBe(true);
    expect(flights.some(({ failed }) => !failed)).toBe(true);
    // Only the Pinpoint Lander is unproven here, so its flight fails exactly when the Mission does.
    for (const { failed, missionFailed } of flights) {
      expect(failed).toBe(missionFailed);
    }
  });

  it("says so when a strategy neither develops nor flies unproven technology", () => {
    const text = balanceReport(files, 3, [launchNothing]);
    expect(text).toContain("== Technology ==");
    expect(text).toContain("Developments: none");
    expect(text).toContain("First flights of unproven technology: none");
  });
});

describe("the report on Crew", () => {
  /** Flies the smallest Crew to Mars orbit on the first Turn, on this Trajectory, and then nothing. */
  const flyCrewOnce = (trajectoryId?: string): Strategy => ({
    name: "test: fly Crew once",
    description: "Flies two Crew to Mars orbit on the first Turn.",
    plan: (view) => ({
      mission:
        view.turnNumber === 1
          ? {
              launchVehicleId: "meridian-colossus",
              assetIds: [],
              crew: { size: 2 },
              ...(trajectoryId ? { trajectoryId } : {}),
            }
          : null,
    }),
  });
  /** As colossusFromTheStart, but Mars orbit insertion always fails. */
  const failingArrival = {
    ...colossusFromTheStart,
    missionEvents: colossusFromTheStart.missionEvents.map((event) => ({
      ...event,
      failureProbability: event.id === "mars-orbit-insertion" ? 1 : 0,
    })),
  };
  /** The cells after the strategy's name in its row of Crew flown. */
  const crewRow = (text: string) =>
    text
      .slice(text.indexOf("== Crew =="))
      .split("\n")
      .find((line) => /^test: fly Crew once +\d/.test(line))
      ?.replace("test: fly Crew once", "")
      .trim()
      .split(/\s+/);

  it("counts Crewed Missions and their Crew, and how Programs ended by whether they flew Crew", () => {
    const text = balanceReport(colossusFromTheStart, 2, [flyCrewOnce()]);
    expect(text).toContain("== Crew ==");
    const [flew, missions, flown, event, health, supplies, spe, home, atEnd] =
      crewRow(text) ?? [];
    expect([flew, missions, flown, event, spe, home]).toEqual(
      "100.0 1.0 2.0 0.0 0.0 0.0".split(" "),
    );
    // With nothing able to fail, their Health or Supplies run out in the end, or they are still at Mars.
    expect(Number(health) + Number(supplies) + Number(atEnd)).toBeCloseTo(2);
    expect(text).toMatch(
      /^test: fly Crew once +yes +100\.0 +\d+ +\d+ +\d+\.\d$/m,
    );
    expect(text).not.toMatch(/^test: fly Crew once +no /m);
  });

  it("counts Crew lost to a failed Mission Event, and Crew a Free-return brings home", () => {
    expect(crewRow(balanceReport(failingArrival, 2, [flyCrewOnce()]))).toEqual(
      "100.0 1.0 2.0 2.0 0.0 0.0 0.0 0.0 0.0".split(" "),
    );
    expect(
      crewRow(balanceReport(failingArrival, 2, [flyCrewOnce("free-return")])),
    ).toEqual("100.0 1.0 2.0 0.0 0.0 0.0 0.0 2.0 0.0".split(" "));
  });

  it("records each Crew member lost once, and a Crew member who flew is lost, home or still at Mars", () => {
    const simulation = simulationOf(colossusFromTheStart);
    const { turns: played } = playProgram(simulation, flyCrewOnce(), 1, turns);
    const lost = played.flatMap(({ crewLost }) => Object.values(crewLost));
    const total = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0);
    expect(
      total(lost) +
        total(played.map(({ crewHome }) => crewHome)) +
        (played.at(-1)?.crewAtMars ?? 0),
    ).toBe(total(played.map(({ crewFlown }) => crewFlown)));
  });

  it("says so when no strategy flew Crew", () => {
    expect(balanceReport(files, 3, [launchNothing])).toContain(
      "Crewed Missions: none",
    );
  });
});
