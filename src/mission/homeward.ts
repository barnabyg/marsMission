import type {
  JourneyHomeOnTimeline,
  Timeline,
  TimelineEntry,
} from "../simulation/simulation";
import type { PlaybackState } from "./playback";

/**
 * The Turn's journey home from Mars as Mission Mode plays it: Mars ascent in the surface view, the rendezvous in Mars
 * orbit in the spacecraft view, the way home in the solar system view and Earth entry, ending in a splashdown, in the
 * spacecraft view again. It only reads the Timeline, so it can't change any results.
 */

/** The Mission Events of the way home, in the order they fly, by their ids in `public/data/mission-events.json`. */
export const homewardEventIds = {
  ascent: "mars-ascent",
  rendezvous: "mars-orbit-rendezvous",
  departure: "trans-earth-injection",
  entry: "earth-entry",
} as const;

export type HomewardPart = keyof typeof homewardEventIds;

const partsInOrder: readonly HomewardPart[] = [
  "ascent",
  "rendezvous",
  "departure",
  "entry",
];

/**
 * How long each part plays for in real time, leaving out pauses, the same at every speed, as days would flash by at 10x.
 * Leaving Mars orbit has nothing to play: the solar system view shows it from then on.
 */
export const homewardPlayMs: Record<HomewardPart, number> = {
  ascent: 7000,
  rendezvous: 6500,
  departure: 0,
  entry: 7000,
};

/** One Mission Event of the way home: which of the Timeline's entries it is, its day, and whether it failed. */
export interface HomewardMoment {
  entryIndex: number;
  day: number;
  failed: boolean;
}

/** The Turn's journey home, with each of its Mission Events that the Timeline has so far. */
export interface Homeward extends JourneyHomeOnTimeline {
  moments: Partial<Record<HomewardPart, HomewardMoment>>;
}

/** Whether an entry is one of the way home's Mission Events, and which. */
export function homewardPartOf(entry: TimelineEntry): HomewardPart | null {
  if (entry.kind !== "missionEvent" || entry.homeward !== true) return null;
  return (
    partsInOrder.find((part) => homewardEventIds[part] === entry.eventId) ??
    null
  );
}

/** The Turn's journey home, or null if none leaves Mars. */
export function homewardOf({
  journeyHome,
  entries,
}: Pick<Timeline, "journeyHome" | "entries">): Homeward | null {
  if (!journeyHome) return null;
  const moments: Homeward["moments"] = {};
  entries.forEach((entry, entryIndex) => {
    const part = homewardPartOf(entry);
    if (part === null || entry.kind !== "missionEvent") return;
    moments[part] = {
      entryIndex,
      day: entry.day,
      failed: entry.outcome === "failure",
    };
  });
  return { ...journeyHome, moments };
}

type Played = Pick<PlaybackState, "playedMs" | "entriesPlayedMs">;

/**
 * Real time played since each part of the way home started playing, for those that have. Each starts when its entry
 * happens, or once the part before it has finished playing if that's later, so that at speed one never cuts another
 * short: the rendezvous waits for the ascent to finish, and the view stays on it until it has played.
 */
export function homewardSince(
  homeward: Homeward | null,
  played: Played,
): Partial<Record<HomewardPart, number>> {
  const since: Partial<Record<HomewardPart, number>> = {};
  let freeFromMs = -Infinity;
  for (const part of partsInOrder) {
    const moment = homeward?.moments[part];
    if (!moment) continue;
    const happenedAtMs = played.entriesPlayedMs[moment.entryIndex];
    if (happenedAtMs === undefined) break;
    const startsAtMs = Math.max(happenedAtMs, freeFromMs);
    if (played.playedMs < startsAtMs) break;
    since[part] = played.playedMs - startsAtMs;
    freeFromMs = startsAtMs + homewardPlayMs[part];
  }
  return since;
}

/** A part of the way home with a sequence of its own, playing now. */
export interface HomewardNow {
  part: "ascent" | "rendezvous" | "entry";
  sinceMs: number;
  failed: boolean;
}

/**
 * The part of the way home whose sequence has started, the latest first, while it plays: Mars ascent, the rendezvous
 * or Earth entry. Mars ascent stays, finished, for the surface view to show what it left behind.
 */
export function homewardStarted(
  homeward: Homeward | null,
  played: Played,
  part: HomewardNow["part"],
): HomewardNow | null {
  const sinceMs = homewardSince(homeward, played)[part];
  const moment = homeward?.moments[part];
  if (sinceMs === undefined || !moment) return null;
  return { part, sinceMs, failed: moment.failed };
}

/** The rendezvous in Mars orbit or Earth entry while it plays, for the spacecraft view, or null if neither is playing. */
export function homewardInSpace(
  homeward: Homeward | null,
  played: Played,
): HomewardNow | null {
  for (const part of ["entry", "rendezvous"] as const) {
    const now = homewardStarted(homeward, played, part);
    if (now && now.sinceMs < homewardPlayMs[part]) return now;
  }
  return null;
}

/**
 * Whether the entry at this index is a part of the way home that isn't asking for its view now: one waiting for the part
 * before it to finish, or the rendezvous or Earth entry once it has played, after which Mission Mode moves back to where
 * it was.
 */
export function homewardQuiet(
  homeward: Homeward | null,
  played: Played,
  entryIndex: number,
): boolean {
  if (!homeward) return false;
  const part = partsInOrder.find(
    (candidate) => homeward.moments[candidate]?.entryIndex === entryIndex,
  );
  if (part === undefined) return false;
  const sinceMs = homewardSince(homeward, played)[part];
  if (sinceMs === undefined) return true;
  return (
    (part === "rendezvous" || part === "entry") &&
    sinceMs >= homewardPlayMs[part]
  );
}
