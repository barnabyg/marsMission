import { describe, expect, it } from "vitest";
import type {
  AssetAtMars,
  JourneyHomeOnTimeline,
  TimelineEntry,
} from "../../simulation/simulation";
import { homewardOf } from "../homeward";
import {
  ascentImpactMs,
  ascentKind,
  ascentMs,
  ascentNow,
  ascentSequenceOf,
  ascentStatus,
  engineOutMs,
  liftOffMs,
  riseAt,
  sitesDuringAscent,
} from "./ascent";
import { writeAscentParticles } from "./ascentParticles";
import { newParticlePools, plumeCount } from "./particles";

const member = (
  name: string,
  arrivedOnDay: number,
  untilDay: number | null,
) => ({
  name,
  arrivedOnDay,
  fromDay: 0,
  untilDay,
});

const atAlpha = ({
  name = "Wellspring Fuel Plant",
  ...overrides
}: Partial<AssetAtMars>): AssetAtMars => ({
  key: "lander",
  name,
  label: name,
  kind: "fuel-plant",
  landingSiteName: "Alpha Plain",
  activityName: "Propellant production",
  surfaceMotion: "still",
  arrivedOnDay: -600,
  fromDay: 0,
  untilDay: null,
  ...overrides,
});

/** Crew who came down in two landers, the first two leaving on day 60 and the third staying. */
const crewShip = atAlpha({
  key: "crew:alpha",
  name: "Odyssey",
  kind: "crew",
  untilDay: null,
  crew: [
    member("Ann", -400, 60),
    member("Ben", -400, 60),
    member("Cat", -100, null),
  ],
});

const kestrel = atAlpha({
  key: "kestrel",
  name: "Kestrel Lifter",
  kind: "ascent-vehicle",
  untilDay: 60,
});

const journey = (
  aboard: JourneyHomeOnTimeline["aboard"],
  siteName: string | null = "Alpha Plain",
): JourneyHomeOnTimeline => ({
  aboard,
  siteName,
  vehicleName: "Earth return stage",
  leavesOnDay: 60,
  homeOnDay: 270,
});

const ascentEntry = (outcome: "success" | "failure"): TimelineEntry => ({
  kind: "missionEvent",
  day: 60,
  eventId: "mars-ascent",
  title: "Mars ascent",
  description: "",
  outcome,
  homeward: true,
});

const sequenceFor = (
  aboard: JourneyHomeOnTimeline["aboard"],
  assetsAtMars: AssetAtMars[],
  outcome: "success" | "failure" = "success",
) =>
  ascentSequenceOf(
    { assetsAtMars },
    homewardOf({
      journeyHome: journey(aboard),
      entries: [ascentEntry(outcome)],
    }),
  );

describe("the Turn's Mars ascent", () => {
  it("lifts the Crew's cabin off each lander whose Crew are leaving, in its place at the site", () => {
    expect(sequenceFor("crew", [atAlpha({}), crewShip])).toEqual({
      siteName: "Alpha Plain",
      crewed: true,
      failed: false,
      craft: [{ name: "Odyssey", place: 1, lander: 0 }],
    });
  });

  it("lifts the ascent vehicle's rocket for samples", () => {
    expect(sequenceFor("samples", [kestrel], "failure")).toEqual({
      siteName: "Alpha Plain",
      crewed: false,
      failed: true,
      craft: [{ name: "Kestrel Lifter", place: 0, lander: 0 }],
    });
  });

  it("is nothing for a journey home from Mars orbit, or with no Mars ascent on the Timeline", () => {
    expect(
      ascentSequenceOf(
        { assetsAtMars: [crewShip] },
        homewardOf({
          journeyHome: journey("crew", null),
          entries: [ascentEntry("success")],
        }),
      ),
    ).toBeNull();
    expect(
      ascentSequenceOf(
        { assetsAtMars: [crewShip] },
        homewardOf({ journeyHome: journey("crew"), entries: [] }),
      ),
    ).toBeNull();
  });

  it("starts when its entry happens, and is nothing before", () => {
    const homeward = homewardOf({
      journeyHome: journey("samples"),
      entries: [ascentEntry("success")],
    });
    const sequence = ascentSequenceOf({ assetsAtMars: [kestrel] }, homeward);
    expect(
      ascentNow(sequence, homeward, { playedMs: 500, entriesPlayedMs: [] }),
    ).toBeNull();
    expect(
      ascentNow(sequence, homeward, { playedMs: 900, entriesPlayedMs: [500] })
        ?.elapsedMs,
    ).toBe(400);
  });
});

describe("how Mars ascent rises", () => {
  it("stands on the ground until it lifts off, then climbs faster and faster out of the shot", () => {
    expect(riseAt(false, liftOffMs - 1).altitude).toBe(0);
    const heights = [1500, 2500, 3500, 4500].map(
      (ms) => riseAt(false, ms).altitude,
    );
    const climbs = heights
      .slice(1)
      .map((height, index) => height - (heights[index] ?? 0));
    expect(
      climbs.every(
        (climb, index) => climb > (index === 0 ? 0 : (climbs[index - 1] ?? 0)),
      ),
    ).toBe(true);
    expect(riseAt(false, ascentMs - 1500).altitude).toBeGreaterThan(8);
  });

  it("falls back and hits the ground if it fails, tipping over, with its engine out", () => {
    expect(riseAt(true, engineOutMs - 100).burning).toBe(true);
    const falling = riseAt(true, engineOutMs + 500);
    expect(falling.burning).toBe(false);
    expect(falling.altitude).toBeGreaterThan(0);
    expect(falling.tilt).toBeGreaterThan(0);
    expect(riseAt(true, ascentImpactMs)).toMatchObject({
      altitude: 0,
      impacted: true,
    });
  });

  it("burns, kicks up dust and leaves fire where a failed one hits, all in the pools it's given", () => {
    const pools = newParticlePools();
    const emitter = [{ x: 0, y: 0, z: 0, engineHeight: 0.9 }];
    const shown = () =>
      Array.from(
        { length: plumeCount },
        (_, index) => pools.plume.colors[index * 4 + 3] ?? 0,
      ).filter((opacity) => opacity > 0).length;
    writeAscentParticles(false, 2000, emitter, pools);
    expect(shown()).toBeGreaterThan(0);
    writeAscentParticles(true, ascentImpactMs + 300, emitter, pools);
    expect(shown()).toBeGreaterThan(0);
  });
});

describe("what the player reads of Mars ascent", () => {
  it("names each of the four sequences for the browser tests", () => {
    expect(
      [
        { crewed: false, failed: false },
        { crewed: false, failed: true },
        { crewed: true, failed: false },
        { crewed: true, failed: true },
      ].map(ascentKind),
    ).toEqual(["ascent", "ascent-crash", "crew-ascent", "crew-ascent-crash"]);
  });

  const now = (failed: boolean, elapsedMs: number) => ({
    sequence: {
      siteName: "Alpha Plain",
      crewed: true,
      failed,
      craft: [{ name: "Odyssey", place: 0, lander: 0 }],
    },
    elapsedMs,
  });

  it("says what is lifting off at its site while it runs", () => {
    expect(ascentStatus(now(false, 100), "Alpha Plain")).toBe(
      "Crew Mars ascent: Odyssey",
    );
    expect(ascentStatus(now(true, 100), "Alpha Plain")).toBe(
      "Crew Mars ascent failed: Odyssey",
    );
    expect(ascentStatus(now(false, 100), "Beta Basin")).toBeNull();
    expect(ascentStatus(now(false, ascentMs), "Alpha Plain")).toBeNull();
  });

  it("keeps its site to show while it runs, first, even with nothing left operating there", () => {
    expect(sitesDuringAscent(["Beta Basin"], now(false, 100))).toEqual([
      "Alpha Plain",
      "Beta Basin",
    ]);
    expect(sitesDuringAscent(["Beta Basin"], now(false, ascentMs))).toEqual([
      "Beta Basin",
    ]);
  });
});
