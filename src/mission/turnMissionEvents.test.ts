import { describe, expect, it } from "vitest";
import type { Timeline, TimelineEntry } from "../simulation/simulation";
import { turnMissionEvents } from "./turnMissionEvents";

function timeline(entries: TimelineEntry[]): Timeline {
  return {
    startDate: "2028-12-01",
    durationDays: 790,
    decisionDay: null,
    mission: null,
    landingSites: [],
    assetsAtMars: [],
    dustStorms: [],
    entries,
  };
}

describe("the Mission Events of a Turn, for its summary", () => {
  it("lists every Mission Event in the order it happened, with its date and outcome, and nothing else", () => {
    const events = turnMissionEvents(
      timeline([
        {
          kind: "missionEvent",
          day: 0,
          eventId: "launch",
          title: "Launch",
          description: "The Mission lifts off.",
          outcome: "success",
        },
        {
          kind: "flightProven",
          day: 0,
          title: "Meridian Medium Flight-proven",
          description: "It has flown.",
        },
        {
          kind: "decisionPoint",
          day: 210,
          eventId: "mars-orbit-insertion",
          title: "Mars orbit insertion failing",
          description: "Use the Contingency?",
        },
        {
          kind: "missionEvent",
          day: 210,
          eventId: "mars-orbit-insertion",
          title: "Mars orbit insertion: saved by Backup burn",
          description: "The backup burn worked.",
          outcome: "success",
        },
        {
          kind: "missionEvent",
          day: 215,
          eventId: "entry-descent-landing",
          title: "Entry, descent and landing failed",
          description: "The lander crashed.",
          outcome: "failure",
        },
      ]),
    );

    expect(events).toEqual([
      {
        date: "2028-12-01",
        title: "Launch",
        description: "The Mission lifts off.",
        failed: false,
      },
      {
        date: "2029-06-29",
        title: "Mars orbit insertion: saved by Backup burn",
        description: "The backup burn worked.",
        failed: false,
      },
      {
        date: "2029-07-04",
        title: "Entry, descent and landing failed",
        description: "The lander crashed.",
        failed: true,
      },
    ]);
  });

  it("lists a solar particle event met on the way and a Free-return's coming back, but not a dust storm at Mars", () => {
    const events = turnMissionEvents(
      timeline([
        {
          kind: "hazard",
          hazard: "dustStorm",
          day: 50,
          title: "Dust storm over Jezero Crater",
          description: "Nothing is operating there.",
        },
        {
          kind: "hazard",
          hazard: "solarParticleEvent",
          day: 100,
          title: "Solar particle event",
          description: "A burst of radiation from the Sun.",
        },
        {
          kind: "missionReturned",
          day: 400,
          title: "Back at Earth",
          description: "The Free-return brought it home.",
        },
      ]),
    );

    expect(events).toEqual([
      {
        date: "2029-03-11",
        title: "Solar particle event",
        description: "A burst of radiation from the Sun.",
        failed: false,
      },
      {
        date: "2030-01-05",
        title: "Back at Earth",
        description: "The Free-return brought it home.",
        failed: false,
      },
    ]);
  });

  it("is empty for a Turn with no Mission Events", () => {
    expect(turnMissionEvents(timeline([]))).toEqual([]);
  });
});
