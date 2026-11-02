import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup } from "./testHelpers";
import type { Timeline } from "./timeline";

const refuelledMission = {
  launchVehicleId: "test-refuelled",
  assetIds: ["test-orbiter"],
};
const refuelled: TurnPlan = { mission: refuelledMission };

/** The Mission Events on a Turn's Timeline, with their days and outcomes. */
function missionEventsOn({ entries }: Timeline) {
  return entries.flatMap((entry) =>
    entry.kind === "missionEvent"
      ? [[entry.eventId, entry.day, entry.outcome]]
      : [],
  );
}

describe("orbital refuelling", () => {
  it("adds a tanker launch and a rendezvous, each on its own day after launch and before the Mars transfer burn", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, refuelled);
    expect(missionEventsOn(timeline)).toEqual([
      ["test-launch", 0, "success"],
      ["test-tanker-launch", 1, "success"],
      ["test-rendezvous", 2, "success"],
      ["test-burn", 3, "success"],
      ["test-arrival", 200, "success"],
    ]);
  });

  it("leaves the Mars transfer burn on the day after launch for a Mission without it", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(missionEventsOn(timeline).slice(0, 2)).toEqual([
      ["test-launch", 0, "success"],
      ["test-burn", 1, "success"],
    ]);
  });
});

/** The Test Catalogue with these failure probabilities, and none for the other Mission Events. */
function withFailures(probabilities: Record<string, number>, readiness = {}) {
  const files = testCatalogueFiles();
  const simulation = createSimulation(
    parseCatalogue({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) =>
        vehicle.id === "test-refuelled"
          ? { ...vehicle, ...readiness }
          : vehicle,
      ),
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability: probabilities[event.id] ?? 0,
      })),
    }),
  );
  return { simulation, program: simulation.startProgram(42) };
}

describe("orbital refuelling in Planning Mode", () => {
  it("lists the tanker launch and the rendezvous with their Risk Bands, which Reliability lowers", () => {
    const { simulation, program } = withFailures({
      "test-tanker-launch": 0.08,
      "test-rendezvous": 0.04,
    });
    const bands = (reliability = {}) =>
      simulation
        .previewMission(program, { ...refuelledMission, reliability })
        .map(({ name, riskBand }) => [name, riskBand]);
    expect(bands()).toEqual([
      ["Test launch", "~1%"],
      ["Test tanker launch", "~10%"],
      ["Test rendezvous", "~5%"],
      ["Test burn", "~1%"],
      ["Test arrival", "~1%"],
    ]);
    expect(
      bands({
        "test-tanker-launch": "tested",
        "test-rendezvous": "redundant",
      }).slice(1, 3),
    ).toEqual([
      ["Test tanker launch", "~5%"],
      ["Test rendezvous", "~1%"],
    ]);
  });

  it("raises their Risk Bands while the Launch Vehicle is unproven", () => {
    const { simulation, program } = withFailures(
      { "test-tanker-launch": 0.04, "test-rendezvous": 0.04 },
      {
        technologyReadiness: "built",
        unproven: { costMillions: 600, failureMultiplier: 2 },
      },
    );
    expect(
      simulation
        .previewMission(program, refuelledMission)
        .slice(1, 3)
        .map(({ riskBand }) => riskBand),
    ).toEqual(["~10%", "~10%"]);
  });
});

describe("a failed tanker launch or rendezvous", () => {
  it.each([
    ["test-tanker-launch", "Test tanker launch", 1, 25, "The tanker blew up."],
    ["test-rendezvous", "Test rendezvous", 2, 35, "It missed the tanker."],
  ])(
    "%s loses the Mission and costs Public Support, as the Timeline and the Turn summary say",
    (eventId, name, day, loss, failureDescription) => {
      const { simulation, program } = withFailures({ [eventId]: 1 });
      const {
        timeline,
        summary,
        program: after,
      } = simulation.runTurn(program, refuelled);
      expect(missionEventsOn(timeline).at(-1)).toEqual([
        eventId,
        day,
        "failure",
      ]);
      const failed = timeline.entries.find(
        (entry) => entry.kind === "missionEvent" && entry.outcome === "failure",
      );
      expect(failed?.title).toBe(`${name} failed`);
      expect(failed?.description).toContain(failureDescription);
      expect(timeline.mission?.failedOnDay).toBe(day);
      expect(summary.failure).toEqual({
        missionEventName: name,
        assetsLost: ["Test Orbiter"],
        publicSupportLost: loss,
        returnedToEarth: false,
        refundMillions: 0,
      });
      expect(after.operatingAssets).toEqual([]);
    },
  );
});

describe("a refuelled Launch Vehicle that is unproven", () => {
  const unproven = {
    technologyReadiness: "built",
    unproven: { costMillions: 600, failureMultiplier: 2 },
  };
  const isProven = (simulation: Simulation, program: Program) =>
    simulation
      .readProgram(program)
      .launchVehicles.find(({ id }) => id === "test-refuelled")
      ?.technologyReadiness;

  it("becomes Flight-proven on the day it gets past its rendezvous and Mars transfer burn", () => {
    const { simulation, program } = withFailures({}, unproven);
    const {
      timeline,
      summary,
      program: after,
    } = simulation.runTurn(program, refuelled);
    expect(summary.technologiesProven).toEqual(["Test Refuelled"]);
    expect(
      timeline.entries.find(({ kind }) => kind === "flightProven")?.day,
    ).toBe(3);
    expect(isProven(simulation, after)).toBe("flight-proven");
  });

  it.each(["test-tanker-launch", "test-rendezvous"])(
    "stays unproven when %s fails",
    (eventId) => {
      const { simulation, program } = withFailures({ [eventId]: 1 }, unproven);
      const { summary, program: after } = simulation.runTurn(
        program,
        refuelled,
      );
      expect(summary.technologiesProven).toEqual([]);
      expect(isProven(simulation, after)).toBe("built");
    },
  );
});
