import { describe, expect, it } from "vitest";
import type {
  ProgramView,
  TurnPlan,
  TurnSummary,
} from "../simulation/simulation";
import { homecomingProblems } from "./invalidHomecomings";
import { playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);
/** As above, but Earth entry always fails. */
const failingEntry = simulationOf({
  ...colossusFromTheStart,
  missionEvents: colossusFromTheStart.missionEvents.map((event) => ({
    ...event,
    failureProbability: event.id === "earth-entry" ? 1 : 0,
  })),
});
const roundTrip: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: { size: 2, roundTrip: true, suppliesId: "supplies-ample" },
  },
};

/** The Program before and after a Turn that brings its round-trip Crew home, with that Turn's summary. */
function broughtHome(played = simulation) {
  const there = played.runTurn(played.startProgram(1), roundTrip).program;
  const before = played.readProgram(there);
  const bringHome = before.crew[0]?.waysHome[0]?.key ?? "";
  const { summary, program } = played.runTurn(there, {
    mission: null,
    bringHome,
  });
  return { before, summary, after: played.readProgram(program) };
}

describe("the strategy that brings Crew home", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("round trip and bring them home"),
  );

  it("sends Crew on a round trip, and brings them home on the next Turn", () => {
    if (!strategy) throw new Error("No strategy brings Crew home");
    const { turns: played } = playProgram(simulation, strategy, 1, turns);
    expect(played.some(({ crewHome }) => crewHome > 0)).toBe(true);
  });
});

describe("the checks for invalid homecomings", () => {
  it("find nothing wrong with Crew who come home, or who are lost on the way", () => {
    const home = broughtHome();
    expect(home.summary.crewHome).toHaveLength(2);
    expect(homecomingProblems(home.before, home.summary, home.after)).toEqual(
      [],
    );
    const lost = broughtHome(failingEntry);
    expect(lost.summary.crewLost).toHaveLength(1);
    expect(homecomingProblems(lost.before, lost.summary, lost.after)).toEqual(
      [],
    );
  });

  const { before, summary, after } = broughtHome();
  const [first = "", second = ""] = summary.crewHome;
  const changedSummary = (changes: Partial<TurnSummary>) =>
    homecomingProblems(before, { ...summary, ...changes }, after);
  const noWayHome: ProgramView = {
    ...before,
    crew: before.crew.map((place) => ({ ...place, waysHome: [] })),
  };

  it.each<[string, () => string[], RegExp]>([
    [
      "Crew at Mars home with no way home",
      () => homecomingProblems(noWayHome, summary, after),
      /came home with no way home/,
    ],
    [
      "a journey home for Crew with no way home",
      () => homecomingProblems(noWayHome, { ...summary, crewHome: [] }, after),
      /without Crew who had a way home/,
    ],
    [
      "a Crew member on a journey home who neither got home nor was lost",
      () => changedSummary({ crewHome: [first] }),
      /neither came home nor was lost/,
    ],
    [
      "Crew home from a journey that failed",
      () =>
        changedSummary({
          journeyHome: {
            crew: [first, second],
            samples: 0,
            samplesFrom: null,
            failure: { missionEventName: "Earth entry", publicSupportLost: 20 },
          },
        }),
      /journey home that failed/,
    ],
    [
      "Crew home earning no Public Support",
      () => changedSummary({ publicSupportForCrewHome: 0 }),
      /without earning Public Support/,
    ],
    [
      "a way home offered to Crew who aren't there",
      () =>
        homecomingProblems(before, summary, {
          ...after,
          crew: before.crew.map((place) => ({ ...place, members: [] })),
        }),
      /aren't there/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
  });
});
