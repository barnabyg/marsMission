import { describe, expect, it } from "vitest";
import type { Timeline, TimelineEntry } from "../../simulation/simulation";
import { marsOrbitShot } from "../marsOrbit/MarsOrbitView";
import type { Point } from "../sceneParts";
import { solarSystemShot } from "../solarSystem/SolarSystemView";
import { surfaceCentre } from "../surface/surface";
import { particleCount, writeParticleStream } from "./particleStream";
import {
  assetsInFlight,
  assetsLostOnTheWay,
  assetsOnBoard,
  lossOnTheWayShowing,
  lossShownMs,
  particlesShownMs,
  solarParticleEventShowing,
  spacecraftCentre,
  spacecraftFallback,
  spacecraftHasSomethingToShow,
  spacecraftShot,
  stackLayout,
} from "./spacecraft";

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];

const asset = (overrides: Partial<MissionAsset>): MissionAsset => ({
  name: "Orbiter",
  kind: "orbiter",
  landingSiteName: null,
  deliveredOnDay: 200,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

const missionOf = (
  assets: MissionAsset[],
  overrides: Partial<Mission> = {},
): Mission => ({
  launchDay: 0,
  arrivalDay: 200,
  launchVehicleName: "Test Vehicle",
  assetNames: assets.map(({ name }) => name),
  assets,
  failedOnDay: null,
  ...overrides,
});

const orbiterAndLander = [
  asset({}),
  asset({
    name: "Lander",
    kind: "lander",
    landingSiteName: "Alpha Plain",
    deliveredOnDay: 205,
  }),
];

/** Both lost to the transfer burn on day 1. */
const lostToTheBurn = missionOf(
  orbiterAndLander.map((onBoard) => ({
    ...onBoard,
    deliveredOnDay: null,
    lostOnDay: 1,
  })),
  { failedOnDay: 1 },
);

function entry(overrides: Partial<TimelineEntry>): TimelineEntry {
  return {
    kind: "milestone",
    day: 0,
    milestoneId: "first",
    title: "",
    description: "",
    ...overrides,
  } as TimelineEntry;
}

const launch = entry({
  kind: "missionEvent",
  eventId: "launch",
  outcome: "success",
});
const burnFailed = entry({
  kind: "missionEvent",
  day: 1,
  eventId: "mars-transfer-burn",
  outcome: "failure",
});
const particlesHit = entry({
  kind: "decisionPoint",
  day: 90,
  hazard: "solarParticleEvent",
});
const particlesLost = entry({
  kind: "hazard",
  day: 90,
  hazard: "solarParticleEvent",
});

/** Playback with every entry so far having happened at these real played times, now at `playedMs`. */
function played(day: number, entriesPlayedMs: number[], playedMs: number) {
  return {
    day,
    entriesHappened: entriesPlayedMs.length,
    entriesPlayedMs,
    playedMs,
  };
}

describe("what the spacecraft carries on its way to Mars", () => {
  const names = (assets: { name: string }[]) => assets.map(({ name }) => name);

  it("carries every Asset from launch until arrival, in order", () => {
    const mission = missionOf(orbiterAndLander);
    expect(names(assetsInFlight(mission, 0))).toEqual(["Orbiter", "Lander"]);
    expect(names(assetsInFlight(mission, 199.9))).toEqual([
      "Orbiter",
      "Lander",
    ]);
    expect(assetsInFlight(mission, 200)).toEqual([]);
  });

  it("carries nothing with no Mission", () => {
    expect(assetsInFlight(null, 10)).toEqual([]);
    expect(assetsOnBoard(null, 10)).toEqual([]);
  });

  it("stops carrying what's lost, from the day it's lost", () => {
    expect(names(assetsInFlight(lostToTheBurn, 0.9))).toEqual([
      "Orbiter",
      "Lander",
    ]);
    expect(assetsInFlight(lostToTheBurn, 1)).toEqual([]);
    expect(names(assetsLostOnTheWay(lostToTheBurn, 1))).toEqual([
      "Orbiter",
      "Lander",
    ]);
  });

  it("never carries what's lost at launch, which hasn't left Earth", () => {
    const lostAtLaunch = missionOf(
      [asset({ deliveredOnDay: null, lostOnDay: 0 })],
      {
        failedOnDay: 0,
      },
    );
    expect(assetsInFlight(lostAtLaunch, 0)).toEqual([]);
    expect(assetsLostOnTheWay(lostAtLaunch, 0)).toEqual([]);
  });

  it("doesn't count what's lost at Mars as lost on the way", () => {
    const lostAtMars = missionOf(
      [asset({ deliveredOnDay: null, lostOnDay: 200 })],
      { failedOnDay: 200 },
    );
    expect(assetsLostOnTheWay(lostAtMars, 250)).toEqual([]);
  });

  it("shows each Asset on board as carried or lost", () => {
    expect(assetsOnBoard(missionOf(orbiterAndLander), 50)).toEqual([
      { name: "Orbiter", kind: "orbiter", lost: false },
      { name: "Lander", kind: "lander", lost: false },
    ]);
    expect(assetsOnBoard(lostToTheBurn, 5)).toEqual([
      { name: "Orbiter", kind: "orbiter", lost: true },
      { name: "Lander", kind: "lander", lost: true },
    ]);
  });
});

describe("whether the spacecraft view has something to show", () => {
  it("has while a Mission is in flight", () => {
    const timeline = {
      mission: missionOf(orbiterAndLander),
      entries: [launch],
    };
    expect(spacecraftHasSomethingToShow(timeline, played(50, [0], 1000))).toBe(
      true,
    );
  });

  it("has nothing with no Mission, or once it has arrived", () => {
    expect(
      spacecraftHasSomethingToShow(
        { mission: null, entries: [] },
        played(50, [], 0),
      ),
    ).toBe(false);
    expect(
      spacecraftHasSomethingToShow(
        { mission: missionOf(orbiterAndLander), entries: [launch] },
        played(200, [0], 9000),
      ),
    ).toBe(false);
  });

  it("shows a failed transfer burn for a few seconds of real time, and then has nothing", () => {
    const timeline = { mission: lostToTheBurn, entries: [launch, burnFailed] };
    const at = (playedMs: number) => played(30, [0, 1000], playedMs);
    expect(lossOnTheWayShowing(timeline, at(1000))).toBe(true);
    expect(
      spacecraftHasSomethingToShow(timeline, at(1000 + lossShownMs - 1)),
    ).toBe(true);
    expect(spacecraftHasSomethingToShow(timeline, at(1000 + lossShownMs))).toBe(
      false,
    );
  });

  it("shows a Mission lost to a solar particle event for a few seconds too", () => {
    const lost = missionOf([asset({ deliveredOnDay: null, lostOnDay: 90 })], {
      failedOnDay: 90,
    });
    const timeline = {
      mission: lost,
      entries: [launch, particlesHit, particlesLost],
    };
    expect(
      lossOnTheWayShowing(timeline, played(90, [0, 500, 3000], 3000)),
    ).toBe(true);
    expect(
      lossOnTheWayShowing(
        timeline,
        played(140, [0, 500, 3000], 3000 + lossShownMs),
      ),
    ).toBe(false);
  });

  it("doesn't take a solar particle event the Mission comes through for a loss", () => {
    const timeline = {
      mission: missionOf(orbiterAndLander),
      entries: [launch, particlesHit, particlesLost],
    };
    expect(
      lossOnTheWayShowing(timeline, played(90, [0, 500, 3000], 3000)),
    ).toBe(false);
  });

  it("doesn't take a successful transfer burn for a loss", () => {
    const timeline = {
      mission: missionOf(orbiterAndLander),
      entries: [launch, { ...burnFailed, outcome: "success" } as TimelineEntry],
    };
    expect(lossOnTheWayShowing(timeline, played(1, [0, 0], 0))).toBe(false);
  });
});

describe("a solar particle event on screen", () => {
  const entries = [launch, particlesHit, particlesLost];

  it("isn't showing before it hits", () => {
    expect(solarParticleEventShowing(entries, played(50, [0], 5000))).toBe(
      false,
    );
  });

  it("shows while play waits at its Decision Point, which holds the real time played", () => {
    expect(
      solarParticleEventShowing(entries, played(90, [0, 2000], 2000)),
    ).toBe(true);
  });

  it("shows for a few seconds from the answer, and then stops", () => {
    const answeredAt = 2000;
    const at = (playedMs: number) =>
      played(95, [0, 1000, answeredAt], playedMs);
    expect(
      solarParticleEventShowing(entries, at(answeredAt + particlesShownMs - 1)),
    ).toBe(true);
    expect(
      solarParticleEventShowing(entries, at(answeredAt + particlesShownMs)),
    ).toBe(false);
  });
});

describe("where the spacecraft view hands over to", () => {
  it("goes to the solar system on the way to Mars", () => {
    expect(spacecraftFallback(missionOf(orbiterAndLander), 50)).toBe(
      "solarSystem",
    );
    expect(spacecraftFallback(null, 50)).toBe("solarSystem");
  });

  it("goes to the solar system when the Mission was lost on the way", () => {
    expect(spacecraftFallback(lostToTheBurn, 300)).toBe("solarSystem");
  });

  it("goes to Mars orbit once the Mission has arrived", () => {
    expect(spacecraftFallback(missionOf(orbiterAndLander), 200)).toBe(
      "marsOrbit",
    );
  });

  it("goes to the solar system for a Free-return heading home", () => {
    const returning = missionOf(
      [asset({ deliveredOnDay: null, lostOnDay: 200 })],
      {
        failedOnDay: 200,
        returnsToEarth: { fromDay: 200, backOnDay: 620 },
      },
    );
    expect(spacecraftFallback(returning, 250)).toBe("solarSystem");
  });
});

describe("the spacecraft's place in the scene", () => {
  it("puts the cruise stage first and the Assets after it in order, centred on the shot", () => {
    const { cruise, assets } = stackLayout(3);
    expect(assets).toHaveLength(3);
    expect([cruise, ...assets]).toEqual(
      [cruise, ...assets].toSorted((first, second) => first - second),
    );
    const half = (assets.at(-1) ?? 0) + 0.45;
    expect(cruise - 0.35).toBeCloseTo(-half);
  });

  it("is inside the stars and well away from the other views", () => {
    const distance = (first: Point, second: Point) =>
      Math.hypot(...first.map((value, index) => value - (second[index] ?? 0)));
    expect(distance(spacecraftShot.position, [0, 0, 0])).toBeLessThan(30);
    expect(distance(spacecraftCentre, surfaceCentre)).toBeGreaterThan(25);
    expect(distance(spacecraftCentre, marsOrbitShot.target)).toBeGreaterThan(
      25,
    );
  });

  it("looks away from the other views, so they cost nothing to draw from here", () => {
    const [x, y, z] = spacecraftShot.position;
    const looking = spacecraftShot.target.map(
      (value, index) => value - (spacecraftShot.position[index] ?? 0),
    );
    for (const [px, py, pz] of [
      surfaceCentre,
      marsOrbitShot.target,
      solarSystemShot.target,
    ]) {
      const towards = [px - x, py - y, pz - z];
      const dot = towards.reduce(
        (total, value, index) => total + value * (looking[index] ?? 0),
        0,
      );
      expect(dot).toBeLessThan(0);
    }
  });
});

describe("a solar particle event's stream", () => {
  it("moves on with time and stays round the spacecraft", () => {
    const now = new Float32Array(particleCount * 3);
    const later = new Float32Array(particleCount * 3);
    writeParticleStream(now, 3);
    writeParticleStream(later, 3.1);
    expect(later).not.toEqual(now);
    for (const value of [...now, ...later]) {
      expect(Math.abs(value)).toBeLessThan(8);
    }
  });

  it("comes out the same for the same time", () => {
    const first = new Float32Array(particleCount * 3);
    const second = new Float32Array(particleCount * 3);
    writeParticleStream(first, 7.5);
    writeParticleStream(second, 7.5);
    expect(second).toEqual(first);
  });
});
