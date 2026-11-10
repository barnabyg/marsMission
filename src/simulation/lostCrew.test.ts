import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { healthRanOut } from "./lostCrew";
import { skipTurn, steadyHealth, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const sendCrew: TurnPlan = { mission: crewMission };

describe("losing Crew to a failed Mission Event", () => {
  it("kills the Crew in a failed launch, and never gives their names again", () => {
    const { simulation, program } = withFailures(["test-launch"]);
    const { program: next, summary } = simulation.runTurn(program, sendCrew);
    expect(summary.crewLost).toEqual([
      {
        names: ["Ann Able", "Ben Baker"],
        cause: "missionEvent",
        description:
          "Ann Able and Ben Baker were lost when Test launch failed.",
        publicSupportLost: 40,
      },
    ]);
    const view = simulation.readProgram(next);
    expect(view.crew).toEqual([]);
    expect(view.crewedMission.namesLeft).toBe(3);
    expect(simulation.previewCrew(next, crewMission)?.names).toEqual([
      "Cal Cole",
      "Dee Dunn",
    ]);
  });

  it("costs a large drop in Public Support for each Crew member, on top of the failed Mission Event's own loss", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { summary } = simulation.runTurn(program, sendCrew);
    expect(summary.failure?.publicSupportLost).toBe(30);
    expect(
      summary.crewLost.map(({ publicSupportLost }) => publicSupportLost),
    ).toEqual([40]);
    // 100 less 30 for the burn and 20 for each of the two Crew, then 15% fades.
    expect(summary.publicSupportEnd).toBe(25);
    expect(summary.publicSupportDrained).toBe(5);
  });

  it("never takes Public Support below zero", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { summary } = simulation.runTurn(
      { ...program, publicSupport: 50 },
      { mission: { ...crewMission, crew: { size: 3 } } },
    );
    expect(
      summary.crewLost.map(({ publicSupportLost }) => publicSupportLost),
    ).toEqual([20]);
    expect(summary.publicSupportEnd).toBe(0);
  });

  it("names each Crew member lost in the events column, on the day of the failure", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { timeline } = simulation.runTurn(program, sendCrew);
    expect(timeline.entries.map(({ kind, title }) => [kind, title])).toEqual([
      ["missionEvent", "Test launch"],
      ["missionEvent", "Test burn failed"],
      ["crewLost", "Crew lost"],
    ]);
    expect(timeline.entries.find(({ kind }) => kind === "crewLost")).toEqual({
      kind: "crewLost",
      day: 1,
      title: "Crew lost",
      description:
        "Ann Able and Ben Baker were lost when Test burn failed. Losing Crew costs 40 Public Support.",
    });
  });

  it("warns at a Contingency's Decision Point what losing the Crew would cost", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { decisionPoint } = simulation.workOutTurn(program, {
      mission: { ...crewMission, contingencyIds: ["test-spare-engine"] },
    });
    expect(decisionPoint?.choices[1].description).toBe(
      "Ann Able, Ben Baker are lost, and it costs 30 Public Support. Losing the Crew costs 40 Public Support more.",
    );
  });
});

describe("Crew at Mars when a later Crew is lost", () => {
  it("keep their Activity and earn all Turn, while the lost Crew earn nothing", () => {
    const { simulation, program } = withFailures(["test-arrival"], {
      startingMoneyMillions: 5000,
      crewHealth: steadyHealth,
    });
    const rescued = simulation.runTurn(
      program,
      {
        mission: { ...crewMission, contingencyIds: ["test-reserve-fuel"] },
      },
      { "contingency:test-arrival": "use" },
    );
    const { program: next, summary } = simulation.runTurn(
      rescued.program,
      sendCrew,
    );
    expect(summary.crewLost.map(({ names }) => names)).toEqual([
      ["Cal Cole", "Dee Dunn"],
    ]);
    // All 780 days of the Turn, for Ann Able and Ben Baker only.
    expect(summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Mars orbit",
        activityName: "Test research",
        science: 156,
        publicSupport: 78,
        days: 780,
      },
    ]);
    expect(summary.crew.map(({ name }) => name)).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
    const view = simulation.readProgram(next);
    expect(
      view.crew.flatMap(({ members }) => members.map(({ name }) => name)),
    ).toEqual(["Ann Able", "Ben Baker"]);
    expect(view.crewedMission.namesLeft).toBe(1);
  });
});

describe("a Free-return after a failed arrival burn", () => {
  const freeReturn: TurnPlan = {
    mission: { ...crewMission, trajectoryId: "test-free-return" },
  };

  it("brings the Crew home alive, earning Public Support for each and the First Crew home Milestone, and losing none for them", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { summary } = simulation.runTurn(program, freeReturn);
    expect(summary.crewHome).toEqual(["Ann Able", "Ben Baker"]);
    expect(summary.crewLost).toEqual([]);
    expect(summary.failure).toMatchObject({
      returnedToEarth: true,
      publicSupportLost: 0,
    });
    // 40 for each Crew member home and 300 for the Milestone, before the drain.
    expect(summary.publicSupportGained).toBe(2 * 40 + 300);
    expect(summary.publicSupportEnd).toBe(Math.round((100 + 380) * 0.85));
  });

  it("names the Crew home in the events column, and never flies them again", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const { program: next, timeline } = simulation.runTurn(program, freeReturn);
    expect(
      timeline.entries.find(({ kind }) => kind === "missionReturned"),
    ).toMatchObject({
      day: 520,
      description:
        "Ann Able and Ben Baker are home safe. None of them will fly again.",
    });
    const view = simulation.readProgram(next);
    expect(view.crew).toEqual([]);
    expect(view.crewedMission.namesLeft).toBe(3);
  });

  it("still loses the Crew to a Mission Event before the arrival burn", () => {
    const { simulation, program } = withFailures(["test-burn"]);
    const { summary } = simulation.runTurn(program, freeReturn);
    expect(summary.crewHome).toEqual([]);
    expect(summary.crewLost.map(({ cause }) => cause)).toEqual([
      "missionEvent",
    ]);
  });
});

describe("saving lost and home Crew", () => {
  it("keeps them out of Mars, and their names given, through saving and loading", () => {
    const { simulation, program } = withFailures(["test-launch"], {
      startingMoneyMillions: 5000,
    });
    // Enough Public Support that losing them doesn't cancel the Program.
    const lost = simulation.runTurn(
      { ...program, publicSupport: 300 },
      sendCrew,
    ).program;
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(lost))),
    );
    expect(restored).toEqual(lost);
    expect(simulation.readProgram(restored).crewedMission.namesLeft).toBe(3);
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(lost, skipTurn),
    );
  });

  it("keeps Crew brought home through saving and loading", () => {
    const { simulation, program } = withFailures(["test-arrival"]);
    const home = simulation.runTurn(program, {
      mission: { ...crewMission, trajectoryId: "test-free-return" },
    }).program;
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(home))),
    );
    expect(restored).toEqual(home);
    expect(simulation.readProgram(restored).crewedMission.namesLeft).toBe(3);
  });
});

describe("whose loss a Health running out is put down to", () => {
  const outages = [{ fromDay: 100, toDay: 200 }];

  it("is their Supplies when having none took some of their Health", () => {
    const [loss] = healthRanOut(
      [
        {
          name: "Ann Able",
          lost: [
            { cause: "radiationAtMars", health: 5 },
            { cause: "noSupplies", health: 2 },
          ],
        },
      ],
      101,
      outages,
      "in Mars orbit",
    );
    expect(loss?.cause).toBe("supplies");
  });

  it("is their Health when other causes used it all up on the day the Supplies ran out", () => {
    const [loss] = healthRanOut(
      [
        {
          name: "Ann Able",
          lost: [
            { cause: "radiationAtMars", health: 4 },
            { cause: "timeAtMars", health: 3 },
          ],
        },
      ],
      101,
      outages,
      "in Mars orbit",
    );
    expect(loss?.cause).toBe("health");
    expect(loss?.how).toBe("in Mars orbit, when their Health ran out");
  });
});
