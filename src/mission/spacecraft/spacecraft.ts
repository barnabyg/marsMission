import type { Timeline, TimelineEntry } from "../../simulation/simulation";
import { msSinceEntry, type PlaybackState } from "../playback";
import type { CameraPose, Point } from "../sceneParts";
import { earthOrbitNow, refuellingOf } from "./refuelling";

/**
 * The Mission close up, on the far side of the solar system from both other views and inside the stars. The
 * solar system's Sun lights it from behind the camera.
 */
export const spacecraftCentre: Point = [-20, 0, 0];

/** Looks out away from the other views, so that they cost nothing to draw from here. */
export const spacecraftShot: CameraPose = {
  position: [-13.4, 1.8, 2.4],
  target: spacecraftCentre,
};

/** How long a Mission lost on the way stays on screen, in real time at every speed, before the view moves on. */
export const lossShownMs = 4000;

/** How long a solar particle event shows when it hits, and again from the player's answer, in real time at every speed. */
export const particlesShownMs = 6000;

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];

/** How far along playback is, which is all these need of it. */
type Played = Pick<
  PlaybackState,
  "day" | "entriesHappened" | "playedMs" | "entriesPlayedMs"
>;

/** The Assets on board and on their way to Mars on a given day: launched, and not yet delivered or lost. */
export function assetsInFlight(
  mission: Mission | null,
  day: number,
): MissionAsset[] {
  if (!mission || day < mission.launchDay || day >= mission.arrivalDay) {
    return [];
  }
  return mission.assets.filter(
    ({ deliveredOnDay, lostOnDay }) =>
      (deliveredOnDay === null || day < deliveredOnDay) &&
      (lostOnDay === null || day < lostOnDay),
  );
}

/** The Assets lost on the way to Mars by a given day, after leaving Earth and before arriving. */
export function assetsLostOnTheWay(
  mission: Mission | null,
  day: number,
): MissionAsset[] {
  if (!mission) return [];
  return mission.assets.filter(
    ({ lostOnDay }) =>
      lostOnDay !== null &&
      day >= lostOnDay &&
      lostOnDay > mission.launchDay &&
      lostOnDay < mission.arrivalDay,
  );
}

/** What the view shows on board on a given day, in the order the Mission carries it: each Asset in flight, or lost on the way. */
export function assetsOnBoard(
  mission: Mission | null,
  day: number,
): { name: string; kind: string; lost: boolean }[] {
  const inFlight = assetsInFlight(mission, day);
  const lost = assetsLostOnTheWay(mission, day);
  return (mission?.assets ?? []).flatMap((asset) =>
    inFlight.includes(asset) || lost.includes(asset)
      ? [{ name: asset.name, kind: asset.kind, lost: lost.includes(asset) }]
      : [],
  );
}

/** Whether an entry is the end of the Mission on its way: the transfer burn failing, or a solar particle event losing it. */
function endsTheJourney(entry: TimelineEntry, mission: Mission | null) {
  if (entry.kind === "missionEvent") {
    return (
      entry.eventId === "mars-transfer-burn" && entry.outcome === "failure"
    );
  }
  return (
    entry.kind === "hazard" &&
    entry.hazard === "solarParticleEvent" &&
    entry.day === mission?.failedOnDay
  );
}

/** Whether the latest entry so far to match happened less than this long ago in real played time, which pausing holds. */
function happenedWithin(
  entries: readonly TimelineEntry[],
  played: Played,
  matches: (entry: TimelineEntry) => boolean,
  ms: number,
): boolean {
  const index = entries.slice(0, played.entriesHappened).findLastIndex(matches);
  const since = index < 0 ? null : msSinceEntry(played, index);
  return since !== null && since < ms;
}

/** Whether the Mission has just been lost on its way, which the view shows for a few seconds. */
export function lossOnTheWayShowing(
  timeline: Pick<Timeline, "entries" | "mission">,
  played: Played,
): boolean {
  return happenedWithin(
    timeline.entries,
    played,
    (entry) => endsTheJourney(entry, timeline.mission),
    lossShownMs,
  );
}

/** Whether a solar particle event is sweeping past: for a few seconds when it hits, all the while play waits for an answer, and a few seconds from the answer. */
export function solarParticleEventShowing(
  entries: readonly TimelineEntry[],
  played: Played,
): boolean {
  return happenedWithin(
    entries,
    played,
    (entry) =>
      (entry.kind === "decisionPoint" || entry.kind === "hazard") &&
      entry.hazard === "solarParticleEvent",
    particlesShownMs,
  );
}

/** Whether the spacecraft view has anything to show: a Mission in flight, one just lost on the way, or one in Earth orbit for Orbital refuelling. */
export function spacecraftHasSomethingToShow(
  timeline: Pick<Timeline, "entries" | "mission">,
  played: Played,
): boolean {
  return (
    assetsInFlight(timeline.mission, played.day).length > 0 ||
    lossOnTheWayShowing(timeline, played) ||
    earthOrbitNow(refuellingOf(timeline.entries), played) !== null
  );
}

/** Where the spacecraft view hands over to when it has nothing to show: Mars orbit once the Mission has got there, or else the solar system, which shows a Free-return heading home. */
export function spacecraftFallback(
  mission: Mission | null,
  day: number,
): "marsOrbit" | "solarSystem" {
  if (!mission || day < mission.arrivalDay) return "solarSystem";
  const { failedOnDay, returnsToEarth } = mission;
  const lostOnTheWay = failedOnDay !== null && failedOnDay < mission.arrivalDay;
  const returning =
    returnsToEarth !== undefined && day >= returnsToEarth.fromDay;
  return lostOnTheWay || returning ? "solarSystem" : "marsOrbit";
}

/** The cruise stage's length along the stack, and each Asset's, with the gap between them. */
const cruiseLength = 0.7;
const assetLength = 0.9;
const gap = 0.12;

/** The stack's length from the back of the cruise stage to the front of the last Asset. */
function stackLength(assetCount: number): number {
  return cruiseLength + assetCount * (gap + assetLength);
}

/** Where the middle of the cruise stage and of each Asset is along the stack, which is centred on the shot. */
export function stackLayout(assetCount: number): {
  cruise: number;
  assets: number[];
} {
  const start = -stackLength(assetCount) / 2;
  return {
    cruise: start + cruiseLength / 2,
    assets: Array.from(
      { length: assetCount },
      (_, index) =>
        start +
        cruiseLength +
        gap +
        index * (gap + assetLength) +
        assetLength / 2,
    ),
  };
}

/**
 * The Mission in Earth orbit, beside the spacecraft view's shot and looking the same way, so that when the Mission
 * leaves for Mars the camera slides across from one to the other. The Sun lights it from behind the camera.
 */
export const earthOrbitCentre: Point = [-20, 0, 8];

export const earthOrbitShot: CameraPose = {
  position: [-11.5, 2.2, 8],
  target: earthOrbitCentre,
};

/** The lengths along the Mission in Earth orbit of the Tanker and of the upper stage that makes the Mars transfer burn. */
export const tankerLength = 1.6;
export const upperStageLength = 1.1;
const dockingGap = 0.1;
const stageGap = 0.12;

/**
 * Where the middle of each part is along x in Earth orbit, with the Tanker docked: the Tanker, the docking port, the
 * upper stage, and the middle of the Mission as the spacecraft view draws it, with half its length. The whole row is
 * centred on the shot.
 */
export function earthOrbitLayout(assetCount: number): {
  tanker: number;
  dock: number;
  upperStage: number;
  stack: number;
  stackHalfLength: number;
} {
  const stackHalfLength = stackLength(assetCount) / 2;
  const total =
    tankerLength +
    dockingGap +
    upperStageLength +
    stageGap +
    stackHalfLength * 2;
  const start = -total / 2;
  const dock = start + tankerLength + dockingGap / 2;
  return {
    tanker: start + tankerLength / 2,
    dock,
    upperStage: dock + dockingGap / 2 + upperStageLength / 2,
    stack:
      dock + dockingGap / 2 + upperStageLength + stageGap + stackHalfLength,
    stackHalfLength,
  };
}
