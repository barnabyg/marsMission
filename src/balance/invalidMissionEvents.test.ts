import { describe, expect, it } from "vitest";
import type { Timeline, TurnPlan } from "../simulation/simulation";
import { missionEventProblems } from "./invalidStates";
import { files, simulationOf } from "./testHelpers";

/** The real data files with the Meridian Colossus built, and the named Mission Event certain to fail. */
function withColossus(failing: string | null) {
  return simulationOf({
    ...files,
    launchVehicles: files.launchVehicles.map((vehicle) =>
      vehicle.id === "meridian-colossus"
        ? {
            ...vehicle,
            technologyReadiness: "built" as const,
            development: undefined,
          }
        : vehicle,
    ),
    missionEvents: files.missionEvents.map((event) => ({
      ...event,
      failureProbability: event.id === failing ? 1 : 0,
    })),
  });
}

const refuelled: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: ["pathfinder-orbiter"],
  },
};

function turnOn(failing: string | null) {
  const simulation = withColossus(failing);
  return simulation.runTurn(simulation.startProgram(1), refuelled);
}

describe("the checks for invalid Mission Events", () => {
  it.each([null, "tanker-launch", "rendezvous"])(
    "find nothing wrong with a refuelled Mission when %s fails",
    (failing) => {
      const { timeline, summary } = turnOn(failing);
      expect(missionEventProblems(timeline, summary)).toEqual([]);
    },
  );

  const flown = turnOn(null);
  const lost = turnOn("rendezvous");
  const changed = (
    { timeline, summary }: typeof flown,
    change: (timeline: Timeline) => Timeline,
  ) => missionEventProblems(change(timeline), summary).join(" ");
  const moved = (eventId: string, day: number) => (timeline: Timeline) => ({
    ...timeline,
    entries: timeline.entries.map((entry) =>
      entry.kind === "missionEvent" && entry.eventId === eventId
        ? { ...entry, day }
        : entry,
    ),
  });

  it.each<[string, () => string, RegExp]>([
    [
      "two Mission Events on one day",
      () => changed(flown, moved("rendezvous", 1)),
      /on the same day/,
    ],
    [
      "a Mission Event after the one that failed",
      () =>
        changed(lost, (timeline) => ({
          ...timeline,
          entries: [
            ...timeline.entries,
            {
              kind: "missionEvent",
              day: 3,
              eventId: "mars-transfer-burn",
              title: "Mars transfer burn",
              description: "",
              outcome: "success",
            },
          ],
        })),
      /after one failed/,
    ],
    [
      "a failure the Turn summary doesn't report",
      () =>
        changed(lost, (timeline) => ({
          ...timeline,
          entries: timeline.entries.filter(
            (entry) =>
              entry.kind !== "missionEvent" || entry.outcome !== "failure",
          ),
        })),
      /doesn't match the Turn summary/,
    ],
    [
      "an Asset delivered after the Mission was lost",
      () =>
        changed(lost, (timeline) => ({
          ...timeline,
          mission: timeline.mission && {
            ...timeline.mission,
            assets: timeline.mission.assets.map((asset) => ({
              ...asset,
              deliveredOnDay: 210,
              lostOnDay: null,
            })),
          },
        })),
      /delivered after the Mission was lost/,
    ],
  ])("catch %s", (_, check, expected) => {
    expect(check()).toMatch(expected);
  });
});
