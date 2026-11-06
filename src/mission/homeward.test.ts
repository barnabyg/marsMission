import { describe, expect, it } from "vitest";
import type {
  JourneyHomeOnTimeline,
  TimelineEntry,
} from "../simulation/simulation";
import {
  homewardInSpace,
  homewardOf,
  homewardPlayMs,
  homewardQuiet,
  homewardSince,
} from "./homeward";
import {
  currentView,
  landingSitePick,
  startingChoice,
  viewAskedForBy,
} from "./missionViews";

const journey = (
  overrides: Partial<JourneyHomeOnTimeline> = {},
): JourneyHomeOnTimeline => ({
  aboard: "crew",
  siteName: "Alpha Plain",
  vehicleName: "Earth return stage",
  leavesOnDay: 60,
  homeOnDay: 270,
  ...overrides,
});

const homewardEvent = (
  eventId: string,
  day: number,
  outcome: "success" | "failure" = "success",
): TimelineEntry => ({
  kind: "missionEvent",
  day,
  eventId,
  title: eventId,
  description: "",
  outcome,
  homeward: true,
});

/** A journey home from Alpha Plain, with something else before it on the Timeline. */
const entries: TimelineEntry[] = [
  {
    kind: "missionEvent",
    day: 0,
    eventId: "launch",
    title: "Launch",
    description: "",
    outcome: "success",
  },
  homewardEvent("mars-ascent", 60),
  homewardEvent("mars-orbit-rendezvous", 61),
  homewardEvent("trans-earth-injection", 62),
  homewardEvent("earth-entry", 270),
  { kind: "crewHome", day: 270, title: "Crew home", description: "" },
];

const homeward = homewardOf({ journeyHome: journey(), entries });

/** Playback this far in, with each entry so far having happened at these moments of real time played. */
const playedAt = (playedMs: number, entriesPlayedMs: number[]) => ({
  playedMs,
  entriesPlayedMs,
});

describe("the journey home as Mission Mode plays it", () => {
  it("finds each of its Mission Events on the Timeline", () => {
    expect(homeward?.moments).toEqual({
      ascent: { entryIndex: 1, day: 60, failed: false },
      rendezvous: { entryIndex: 2, day: 61, failed: false },
      departure: { entryIndex: 3, day: 62, failed: false },
      entry: { entryIndex: 4, day: 270, failed: false },
    });
  });

  it("is nothing in a Turn with no journey home", () => {
    expect(homewardOf({ entries })).toBeNull();
  });

  it("plays each part once the one before has finished, so that at speed none cuts another short", () => {
    // At speed, the ascent, the rendezvous and leaving orbit all happen within a second of real time.
    const fast = [0, 1000, 1100, 1200];
    expect(homewardSince(homeward, playedAt(1500, fast))).toEqual({
      ascent: 500,
    });
    const rendezvousStarts = 1000 + homewardPlayMs.ascent;
    expect(
      homewardSince(homeward, playedAt(rendezvousStarts + 300, fast)),
    ).toEqual({ ascent: homewardPlayMs.ascent + 300, rendezvous: 300 });
    const leavesAt = rendezvousStarts + homewardPlayMs.rendezvous;
    expect(homewardSince(homeward, playedAt(leavesAt, fast))).toMatchObject({
      departure: 0,
    });
  });

  it("plays a part when its entry happens if nothing before it is still playing", () => {
    // At 1x, Earth entry happens long after the rest has played.
    expect(
      homewardSince(homeward, playedAt(400_400, [0, 1000, 2500, 4000, 400_000]))
        .entry,
    ).toBe(400);
  });

  it("shows the rendezvous, then Earth entry, close up only while each plays", () => {
    const fast = [0, 1000, 1100, 1200];
    const rendezvousStarts = 1000 + homewardPlayMs.ascent;
    expect(homewardInSpace(homeward, playedAt(2000, fast))).toBeNull();
    expect(
      homewardInSpace(homeward, playedAt(rendezvousStarts + 100, fast)),
    ).toEqual({ part: "rendezvous", sinceMs: 100, failed: false });
    expect(
      homewardInSpace(
        homeward,
        playedAt(rendezvousStarts + homewardPlayMs.rendezvous, fast),
      ),
    ).toBeNull();
    expect(
      homewardInSpace(homeward, playedAt(50_100, [...fast, 50_000])),
    ).toEqual({ part: "entry", sinceMs: 100, failed: false });
  });
});

describe("the views the journey home moves Mission Mode to", () => {
  it("asks for the surface at Mars ascent, the spacecraft at the rendezvous and Earth entry, and the solar system on the way home", () => {
    expect(entries.slice(1, 5).map(viewAskedForBy)).toEqual([
      "surface",
      "spacecraft",
      "solarSystem",
      "spacecraft",
    ]);
  });

  it("goes to the site Mars ascent lifts off from", () => {
    expect(
      landingSitePick(
        entries,
        2,
        { siteName: "Beta Basin", entriesHappened: 0 },
        "Alpha Plain",
      ),
    ).toBe("Alpha Plain");
  });

  /** The view after this much real time played, with every entry up to leaving orbit having happened at speed. */
  const viewAt = (playedMs: number, entriesPlayedMs = [0, 1000, 1100, 1200]) =>
    currentView(entries, entriesPlayedMs.length, startingChoice, (index) =>
      homewardQuiet(homeward, playedAt(playedMs, entriesPlayedMs), index),
    );

  it("stays at the surface while the ascent plays, then moves to the rendezvous, then to the way home", () => {
    const rendezvousStarts = 1000 + homewardPlayMs.ascent;
    const leavesAt = rendezvousStarts + homewardPlayMs.rendezvous;
    expect(viewAt(1500)).toBe("surface");
    expect(viewAt(rendezvousStarts + 100)).toBe("spacecraft");
    expect(viewAt(leavesAt + 100)).toBe("solarSystem");
  });

  it("moves to the spacecraft for Earth entry while it plays, then back to the way home", () => {
    const happened = [0, 1000, 1100, 1200, 50_000];
    expect(viewAt(50_100, happened)).toBe("spacecraft");
    expect(viewAt(50_000 + homewardPlayMs.entry, happened)).toBe("solarSystem");
  });

  it("stays at the site after a failed ascent, as nothing else comes of it", () => {
    const failed: TimelineEntry[] = [
      ...entries.slice(0, 1),
      homewardEvent("mars-ascent", 60, "failure"),
    ];
    const lost = homewardOf({ journeyHome: journey(), entries: failed });
    expect(lost?.moments).toEqual({
      ascent: { entryIndex: 1, day: 60, failed: true },
    });
    expect(
      currentView(failed, 2, startingChoice, (index) =>
        homewardQuiet(lost, playedAt(20_000, [0, 1000]), index),
      ),
    ).toBe("surface");
  });
});
