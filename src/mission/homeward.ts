import type {
  JourneyHomeOnTimeline,
  Timeline,
  TimelineEntry,
} from "../simulation/simulation";
import type { PlaybackState } from "./playback";

/**
 * The Turn's journey home from Mars as Mission Mode plays it: Mars ascent in the surface view, the rendezvous in Mars
 * orbit and Trans-Earth injection in the spacecraft view, the way home in the solar system view and Earth entry, ending in a splashdown, in the
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
 * How long each part plays for in real time, leaving out pauses, the same at every speed, as days would flash by at 20x.
 */
export const homewardPlayMs: Record<HomewardPart, number> = {
  ascent: 7000,
  rendezvous: 6500,
  departure: 6000,
  entry: 8400,
};

/** One Mission Event of the way home: which of the Timeline's entries it is, its day, and whether it failed. */
interface HomewardMoment {
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
 * Real time since each part started on the shared Mission Mode playback clock.
 */
export function homewardSince(
  homeward: Homeward | null,
  played: Played,
): Partial<Record<HomewardPart, number>> {
  const since: Partial<Record<HomewardPart, number>> = {};
  for (const part of partsInOrder) {
    const moment = homeward?.moments[part];
    if (!moment) continue;
    const started = played.entriesPlayedMs[moment.entryIndex];
    if (started !== undefined) since[part] = played.playedMs - started;
  }
  return since;
}

/** A part of the way home with a sequence of its own, playing now. */
export interface HomewardNow {
  part: HomewardPart;
  sinceMs: number;
  failed: boolean;
}

/**
 * How far the requested event has played. Mars ascent stays available after its scene so the site can show the platform.
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

/** The vehicle left in Mars orbit once playback has presented the failed burn or the player has skipped it. */
export function strandedVehicleAfter(
  homeward: Homeward | null,
  played: Played,
): string | null {
  const departure = homewardStarted(homeward, played, "departure");
  return homeward &&
    departure?.failed &&
    departure.sinceMs >= homewardPlayMs.departure
    ? homeward.vehicleName
    : null;
}

/** The current homeward spacecraft close-up, in reverse flight order so the latest event owns the camera. */
export function homewardInSpace(
  homeward: Homeward | null,
  played: Played,
): HomewardNow | null {
  for (const part of ["entry", "departure", "rendezvous"] as const) {
    const now = homewardStarted(homeward, played, part);
    if (now && now.sinceMs < homewardPlayMs[part]) return now;
  }
  return null;
}

/**
 * Whether the entry at this index is a part of the way home that isn't asking for its view now: one waiting for the part
 * before it to finish, or a spacecraft close-up that has finished.
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
  return part !== "ascent" && sinceMs >= homewardPlayMs[part];
}
