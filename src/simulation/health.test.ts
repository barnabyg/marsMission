import { describe, expect, it } from "vitest";
import type { CatalogueFiles } from "../catalogue/catalogue";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };
const rescuedArrival = {
  mission: { ...crewMission, contingencyIds: ["test-reserve-fuel"] },
};
const useIt = { "contingency:test-arrival": "use" } as const;

/** A Simulation whose Crew lose Health at these rates, and whose named Mission Events always fail. */
const withHealth = (
  crewHealth: Partial<CatalogueFiles["crew"]["health"]>,
  failing: string[] = [],
) => withFailures(failing, { crewHealth });

describe("Health on the way to Mars", () => {
  it("falls with radiation for each day of the Trajectory, so a Slow one costs more than a Fast one", () => {
    const { simulation, program } = setup();
    const lostOnTheWay = (trajectoryId: string) =>
      simulation
        .runTurn(program, { mission: { ...crewMission, trajectoryId } })
        .summary.healthLost.map(({ name, lost }) => [
          name,
          lost.find(({ cause }) => cause === "radiationInFlight")?.health,
        ]);
    // 200 days at 0.1 a day, and 120 days.
    expect(lostOnTheWay("test-slow")).toEqual([
      ["Ann Able", 20],
      ["Ben Baker", 20],
    ]);
    expect(lostOnTheWay("test-fast")).toEqual([
      ["Ann Able", 12],
      ["Ben Baker", 12],
    ]);
  });

  it("is previewed for each Trajectory, as what the Crew will have as they arrive", () => {
    const { simulation, program } = setup();
    expect(simulation.previewCrew(program, crewMission)?.arrivalHealth).toBe(
      80,
    );
    expect(
      simulation.previewCrew(program, {
        ...crewMission,
        trajectoryId: "test-fast",
      })?.arrivalHealth,
    ).toBe(88);
  });

  it("falls by the Contingency's cost for each Crew member on board when a Contingency saves the Mission", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary, program: next } = simulation.runTurn(
      program,
      rescuedArrival,
      useIt,
    );
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [
        { cause: "radiationInFlight", health: 20 },
        { cause: "radiationAtMars", health: 29 },
        { cause: "timeAtMars", health: 29 },
        { cause: "contingency", health: 10 },
      ],
    });
    // 100, less 20 on the way, 10 for the rescue and 58 in 580 days at Mars.
    expect(
      simulation.readProgram(next).crew[0]?.members.map(({ health }) => health),
    ).toEqual([12, 12]);
  });

  it("says at the Decision Point what a rescue would cost the Crew", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { decisionPoint } = simulation.workOutTurn(program, rescuedArrival);
    expect(decisionPoint?.choices[0].description).toMatch(
      /^A second try\. If it works, Ann Able, Ben Baker carry on with 10 less Health each\./,
    );
    const { timeline } = simulation.runTurn(program, rescuedArrival, useIt);
    expect(
      timeline.entries.find(({ title }) => title.includes("saved by"))
        ?.description,
    ).toBe(
      "The reserve fuel caught it. Ann Able and Ben Baker lost 10 Health each.",
    );
  });

  it("can run out before the Crew arrive, if a long Trajectory and a rescue take them to zero", () => {
    // 90 Health in 200 days on the way, and the rescue on arrival takes the last 10.
    const { simulation, program } = withHealth(
      { radiationPerDay: { inFlight: 0.45, atMars: 0.05 } },
      ["test-arrival"],
    );
    const {
      summary,
      timeline,
      program: next,
    } = simulation.runTurn(program, rescuedArrival, useIt);
    expect(summary.crewLost).toEqual([
      {
        names: ["Ann Able", "Ben Baker"],
        cause: "health",
        description:
          "Ann Able and Ben Baker were lost on the way to Mars, when their Health ran out.",
        publicSupportLost: 40,
      },
    ]);
    expect(timeline.entries.find(({ kind }) => kind === "crewLost")?.day).toBe(
      200,
    );
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [
        { cause: "radiationInFlight", health: 90 },
        { cause: "contingency", health: 10 },
      ],
    });
    expect(summary.crew).toEqual([]);
    expect(summary.milestones).toEqual([]);
    expect(simulation.readProgram(next).crew).toEqual([]);
    // Without the rescue's cost, the same Crew arrive with 10 Health, which lasts them 100 days at Mars.
    const unharmed = withHealth({
      radiationPerDay: { inFlight: 0.45, atMars: 0.05 },
    });
    const arrived = unharmed.simulation.runTurn(unharmed.program, sendCrew);
    expect(arrived.summary.milestones.map(({ name }) => name)).toEqual([
      "First Crew at Mars",
    ]);
    expect(arrived.summary.crewLost[0]?.description).toBe(
      "Ann Able and Ben Baker were lost in Mars orbit, when their Health ran out.",
    );
    expect(
      arrived.timeline.entries.find(({ kind }) => kind === "crewLost")?.day,
    ).toBe(300);
  });
});

describe("Health at Mars", () => {
  it("falls with radiation and time at Mars for each day there, and carries on from Turn to Turn", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendCrew);
    // 580 days at Mars at 0.05 a day for each cause, after 20 on the way.
    expect(first.summary.crew.map(({ health }) => health)).toEqual([22, 22]);
    expect(first.summary.healthLost.map(({ lost }) => lost)[1]).toEqual([
      { cause: "radiationInFlight", health: 20 },
      { cause: "radiationAtMars", health: 29 },
      { cause: "timeAtMars", health: 29 },
    ]);
    expect(
      simulation
        .readProgram(first.program)
        .crew[0]?.members.map(({ health }) => health),
    ).toEqual([22, 22]);
    const longer = withFailures([], { startingMoneyMillions: 5000 });
    const second = longer.simulation.runTurn(
      longer.simulation.runTurn(longer.program, sendCrew).program,
      skipTurn,
    );
    // The second Turn's 22 is reached on day 220.
    expect(second.summary.healthLost.map(({ lost }) => lost)[0]).toEqual([
      { cause: "radiationAtMars", health: 11 },
      { cause: "timeAtMars", health: 11 },
    ]);
  });

  it("kills a Crew member on the day it reaches zero, which loses them and stops their Ongoing Research", () => {
    const { simulation, program } = setup();
    const { program: arrived } = simulation.runTurn(program, sendCrew);
    const {
      summary,
      timeline,
      program: next,
    } = simulation.runTurn(arrived, skipTurn);
    expect(summary.crewLost).toEqual([
      {
        names: ["Ann Able", "Ben Baker"],
        cause: "health",
        description:
          "Ann Able and Ben Baker were lost in Mars orbit, when their Health ran out.",
        publicSupportLost: 40,
      },
    ]);
    expect(timeline.entries.filter(({ kind }) => kind === "crewLost")).toEqual([
      {
        kind: "crewLost",
        day: 220,
        title: "Crew lost",
        description:
          "Ann Able and Ben Baker were lost in Mars orbit, when their Health ran out. Losing Crew costs 40 Public Support.",
      },
    ]);
    // 220 days of research for two, where a whole Turn earns 156 Science and 78 Public Support.
    expect(summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Mars orbit",
        activityName: "Test research",
        science: 44,
        publicSupport: 22,
        days: 220,
      },
    ]);
    expect(summary.crew).toEqual([]);
    expect(simulation.readProgram(next).crew).toEqual([]);
    expect(
      timeline.assetsAtMars.find(({ kind }) => kind === "crew"),
    ).toMatchObject({ untilDay: 220 });
  });

  it("can kill one Crew member before another who arrived later", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
    });
    const { program: first } = simulation.runTurn(program, sendCrew);
    const { summary, program: next } = simulation.runTurn(first, sendCrew);
    expect(summary.crewLost.map(({ names, cause }) => [names, cause])).toEqual([
      [["Ann Able", "Ben Baker"], "health"],
    ]);
    expect(summary.crew.map(({ name, health }) => [name, health])).toEqual([
      ["Cal Cole", 22],
      ["Dee Dunn", 22],
    ]);
    expect(
      simulation.readProgram(next).crew[0]?.members.map(({ name }) => name),
    ).toEqual(["Cal Cole", "Dee Dunn"]);
  });
});

describe("Health coming home", () => {
  it("is what the Crew have left when a Free-return brings them home", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary, program: next } = simulation.runTurn(program, {
      mission: { ...crewMission, trajectoryId: "test-free-return" },
    });
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    // 220 days out and 300 back, at 0.1 a day.
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "radiationInFlight", health: 52 }],
    });
    expect(
      simulation.saveProgram(next).program.crew.map(({ health }) => health),
    ).toEqual([48, 48]);
  });

  it("can run out on the way home, which loses the Crew rather than bringing them back", () => {
    const { simulation, program } = withHealth(
      { radiationPerDay: { inFlight: 0.2, atMars: 0.05 } },
      ["test-arrival"],
    );
    const { summary, timeline } = simulation.runTurn(program, {
      mission: { ...crewMission, trajectoryId: "test-free-return" },
    });
    // 0.2 a day runs out on day 500, before the Mission is back on day 520.
    expect(summary.crewHome).toEqual([]);
    expect(summary.crewLost).toMatchObject([
      {
        names: ["Ann Able", "Ben Baker"],
        cause: "health",
        description:
          "Ann Able and Ben Baker were lost on the way home, when their Health ran out.",
      },
    ]);
    expect(timeline.entries.find(({ kind }) => kind === "crewLost")?.day).toBe(
      500,
    );
    expect(
      timeline.entries.find(({ kind }) => kind === "missionReturned")
        ?.description,
    ).toBe("It brought no one home alive.");
  });
});

describe("saving Health", () => {
  it("keeps a lowered Health through a save and a load", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, sendCrew);
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(flown))),
    );
    expect(
      simulation
        .readProgram(restored)
        .crew[0]?.members.map(({ health }) => health),
    ).toEqual([22, 22]);
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(flown, skipTurn),
    );
  });
});
