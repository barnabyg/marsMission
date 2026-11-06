import { describe, expect, it } from "vitest";
import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { crewProblems } from "./invalidCrew";
import { playProgram } from "./playProgram";
import { balanceReport } from "./report";
import { strategies } from "./strategies";
import {
  certain,
  colossusFromTheStart,
  simulationOf,
  turns,
} from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);
/** As above, but Mars orbit insertion always fails. */
const failingArrival = simulationOf({
  ...colossusFromTheStart,
  missionEvents: colossusFromTheStart.missionEvents.map((event) => ({
    ...event,
    failureProbability: event.id === "mars-orbit-insertion" ? 1 : 0,
  })),
});
const crewed = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    // Supplies and Protection that keep them alive for the two Turns these tests follow them.
    crew: {
      size: 2,
      suppliesId: "supplies-ample",
      protectionId: "protection-heavy-shielding",
    },
  },
};

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
      const bringsHome = strategy.name.includes("bring them home");
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

describe("the checks for invalid Crew", () => {
  const start = simulation.startProgram(1);
  const first = simulation.runTurn(start, crewed);
  const second = simulation.runTurn(first.program, crewed);
  const before = simulation.readProgram(first.program);
  const after = simulation.readProgram(second.program);
  const { summary } = second;

  it("find nothing wrong with Crew arriving, and joining Crew already there", () => {
    expect(
      crewProblems(simulation.readProgram(start), first.summary, before),
    ).toEqual([]);
    expect(crewProblems(before, summary, after)).toEqual([]);
    expect(after.crew[0]?.members).toHaveLength(4);
  });

  it("find nothing wrong with Crew landing, at a site landed at for the first time", () => {
    const landing = {
      mission: {
        ...crewed.mission,
        crew: { size: 2, landsAtSite: true },
        landingSiteId: "jezero-crater",
      },
    };
    const landed = simulation.runTurn(first.program, landing);
    const view = simulation.readProgram(landed.program);
    expect(view.crew.map(({ landingSiteId }) => landingSiteId)).toEqual([
      null,
      "jezero-crater",
    ]);
    expect(crewProblems(before, landed.summary, view)).toEqual([]);
  });

  it("find nothing wrong with Crew lost on the way, or brought home by a Free-return", () => {
    const start = failingArrival.startProgram(1);
    const lost = failingArrival.runTurn(start, crewed);
    expect(lost.summary.crewLost).toHaveLength(1);
    expect(
      crewProblems(
        failingArrival.readProgram(start),
        lost.summary,
        failingArrival.readProgram(lost.program),
      ),
    ).toEqual([]);
    const home = failingArrival.runTurn(start, {
      mission: { ...crewed.mission, trajectoryId: "free-return" },
    });
    expect(home.summary.crewHome).toHaveLength(2);
    expect(
      crewProblems(
        failingArrival.readProgram(start),
        home.summary,
        failingArrival.readProgram(home.program),
      ),
    ).toEqual([]);
  });

  const [group] = after.crew;
  if (!group) throw new Error("No Crew arrived");
  const [firstName = ""] = group.members.map(({ name }) => name);
  const lostFirst: TurnSummary["crewLost"][number] = {
    names: [firstName],
    cause: "missionEvent",
    description: "Lost.",
    publicSupportLost: 100,
  };
  const withMembers = (members: typeof group.members) =>
    crewProblems(before, summary, { ...after, crew: [{ ...group, members }] });
  const changedSummary = (changes: Partial<TurnSummary>) =>
    crewProblems(before, { ...summary, ...changes }, after);
  const changedAfter = (changes: Partial<ProgramView>) =>
    crewProblems(before, summary, { ...after, ...changes });

  it.each<[string, () => string[], RegExp]>([
    [
      "two Crew members with one name",
      () => withMembers([...group.members, ...group.members.slice(0, 1)]),
      /share a name/,
    ],
    [
      "a Crew member disappearing",
      () => withMembers(group.members.slice(1)),
      /disappeared/,
    ],
    [
      "a Crew member lost but still at Mars",
      () => changedSummary({ crewLost: [lostFirst] }),
      /lost or home still operates/,
    ],
    [
      "a Crew member brought home but still at Mars",
      () => changedSummary({ crewHome: [firstName] }),
      /lost or home still operates/,
    ],
    [
      "a Crew member lost twice",
      () => changedSummary({ crewLost: [lostFirst, lostFirst] }),
      /lost or brought home twice/,
    ],
    [
      "losing Crew gaining Public Support",
      () =>
        changedSummary({ crewLost: [{ ...lostFirst, publicSupportLost: -1 }] }),
      /gained Public Support/,
    ],
    [
      "Crew earning where none operate",
      () =>
        crewProblems(
          { ...before, crew: [] },
          {
            ...summary,
            ongoingResearch: [
              {
                assetName: "Crew in Phobos orbit",
                activityName: "Crew research",
                science: 1,
                publicSupport: 1,
                days: 1,
              },
            ],
          },
          after,
        ),
      /where no Crew operate/,
    ],
    [
      "Health above the most there is",
      () =>
        withMembers(
          group.members.map((member) => ({ ...member, health: 101 })),
        ),
      /Health is outside 0 to 100/,
    ],
    [
      "Health below zero",
      () =>
        withMembers(group.members.map((member) => ({ ...member, health: -1 }))),
      /Health is outside/,
    ],
    [
      "a Crew member at zero Health still at Mars",
      () =>
        withMembers(group.members.map((member) => ({ ...member, health: 0 }))),
      /zero Health still operates/,
    ],
    [
      "Health lost to a cause that's nothing",
      () =>
        changedSummary({
          healthLost: [
            { name: firstName, lost: [{ cause: "timeAtMars", health: 0 }] },
          ],
        }),
      /lost no Health, or gained some/,
    ],
    [
      "Health that falls by more than the Turn summary says",
      () =>
        withMembers(
          group.members.map((member) => ({
            ...member,
            health: member.health - 1,
          })),
        ),
      /doesn't match what the Turn summary says/,
    ],
    [
      "a Crew member dying of Health they still had",
      () =>
        crewProblems(
          before,
          {
            ...summary,
            crewLost: [{ ...lostFirst, cause: "health" }],
            healthLost: [],
          },
          {
            ...after,
            crew: [
              {
                ...group,
                members: group.members.filter(({ name }) => name !== firstName),
              },
            ],
          },
        ),
      /died of their Health without losing all of it/,
    ],
    [
      "Crew doing an Activity they can't do",
      () => changedAfter({ crew: [{ ...group, activityId: "survey" }] }),
      /an Activity they can't do/,
    ],
    [
      "the same place listed twice",
      () => changedAfter({ crew: [group, group] }),
      /listed twice/,
    ],
    [
      "names given without Crew arriving",
      () =>
        changedAfter({
          crewedMission: { ...after.crewedMission, namesLeft: 0 },
        }),
      /names left to give Crew/,
    ],
    [
      "a Turn summary missing Crew",
      () => changedSummary({ crew: [] }),
      /Turn summary don't match/,
    ],
    [
      "a Turn summary that has the wrong Crew arriving",
      () =>
        changedSummary({
          crew: summary.crew.map((member) => ({ ...member, arrived: true })),
        }),
      /Turn summary don't match/,
    ],
    [
      "Crew at a Landing Site nothing has landed at",
      () =>
        changedAfter({
          crew: [
            {
              ...group,
              landingSiteId: "jezero-crater",
              locationName: "Jezero Crater",
            },
          ],
        }),
      /Landing Site that isn't known or that nothing has landed at/,
    ],
    [
      "a dust storm hurting Crew who sheltered",
      () =>
        changedSummary({
          dustStorms: [
            {
              siteName: "Jezero Crater",
              days: 100,
              answer: "shelter",
              assets: [firstName],
              assetsFailed: [],
              crewHurt: [firstName],
            },
          ],
        }),
      /hurt Crew who sheltered/,
    ],
    [
      "Crew hurt in a dust storm who lost no Health to it",
      () =>
        changedSummary({
          dustStorms: [
            {
              siteName: "Jezero Crater",
              days: 100,
              answer: "carryOn",
              assets: [firstName],
              assetsFailed: [],
              crewHurt: [firstName],
            },
          ],
        }),
      /lost no Health to it/,
    ],
    [
      "Supplies below zero",
      () => changedAfter({ crew: [{ ...group, suppliesDaysLeft: -1 }] }),
      /Supplies left for Crew at Mars are below zero/,
    ],
    [
      "Supplies that don't fall for the same Crew",
      () => {
        const [earlier] = before.crew;
        if (!earlier) throw new Error("No Crew before");
        return changedAfter({ crew: [{ ...earlier }] });
      },
      /didn't fall by a Turn's worth/,
    ],
    [
      "Crew lost to their Supplies with none running out",
      () => changedSummary({ crewLost: [{ ...lostFirst, cause: "supplies" }] }),
      /lost to their Supplies without running out/,
    ],
    [
      "Health lost to having no Supplies with none running out",
      () =>
        changedSummary({
          healthLost: [
            { name: firstName, lost: [{ cause: "noSupplies", health: 5 }] },
          ],
        }),
      /but none ran out/,
    ],
    [
      "Health lost to a solar particle event with no Crew aboard",
      () =>
        changedSummary({
          healthLost: [
            {
              name: firstName,
              lost: [{ cause: "solarParticleEvent", health: 5 }],
            },
          ],
        }),
      /solar particle event cost Health to Crew it didn't harm/,
    ],
    [
      "a solar particle event costing Crew Health when its radiation passed",
      () =>
        changedSummary({
          solarParticleEvent: {
            answer: "carryOn",
            outcome: "unharmed",
            assets: [],
            serviceLifeLossPercent: 0,
            crew: [firstName],
            crewHealthLoss: 35,
          },
        }),
      /solar particle event cost Health to Crew it didn't harm/,
    ],
    [
      "Protection that saved nothing",
      () =>
        changedSummary({
          healthLost: [
            {
              name: firstName,
              lost: [{ cause: "timeAtMars", health: 5 }],
              savedByProtection: 0,
            },
          ],
        }),
      /Protection saved a Crew member no Health/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check().join(" ")).toMatch(expected);
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
  const flyingCrew = strategies.filter(({ name }) => name.includes("Crew"));

  // It plays every strategy that flies Crew, which takes longer than a test usually may now that bases fly Crew too.
  it(
    "are a kind of Decision Point of their own, with rows of their own in the report",
    {
      timeout: 30_000,
    },
    () => {
      const report = balanceReport(stormy, 5, flyingCrew);
      expect(report).toMatch(
        /Decision Points: .*solar particle event with Crew \d+\.\d/,
      );
      const rows = report
        .split("\n")
        .filter((line) => line.startsWith("solar particle event with Crew"))
        .map((line) => line.trim().split(/\s{2,}/));
      expect(rows.map(([kind, answer]) => [kind, answer])).toContainEqual([
        "solar particle event with Crew",
        "safeMode",
      ]);
      for (const row of rows) expect(row).toHaveLength(7);
    },
  );
});
