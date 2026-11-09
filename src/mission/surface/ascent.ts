import type { Timeline } from "../../simulation/simulation";
import { homewardPlayMs, homewardStarted, type Homeward } from "../homeward";
import type { PlaybackState } from "../playback";
import { crewLandersOf } from "./surface";

/**
 * Mars ascent as the surface view plays it: what lifts off from the Landing Site, the Crew's cabin from each lander
 * whose Crew are leaving or the ascent vehicle's rocket, and how it rises, or falls back if it fails. Like a landing it
 * plays for a few seconds of real time, the same at every speed, and pausing holds it (`homeward.ts`). It only displays
 * the Timeline, so it can't change any results.
 */

/** Something lifting off: the Crew's cabin from one of their landers, or the ascent vehicle's rocket. */
export interface AscentCraft {
  name: string;
  /** Its place among the Assets at the site, as the surface view has them all Turn. */
  place: number;
  /** Which of the Crew's landers in its place it lifts off from, which is 0 for an ascent vehicle. */
  lander: number;
}

/** The Turn's Mars ascent. There's at most one, as a Turn has at most one journey home. */
export interface AscentSequence {
  siteName: string;
  /** Whether it lifts off Crew, rather than samples. */
  crewed: boolean;
  failed: boolean;
  craft: AscentCraft[];
}

/** The Turn's Mars ascent, if its journey home lifts off from a Landing Site. */
export function ascentSequenceOf(
  { assetsAtMars }: Pick<Timeline, "assetsAtMars">,
  homeward: Homeward | null,
): AscentSequence | null {
  const moment = homeward?.moments.ascent;
  if (!homeward || !moment || homeward.siteName === null) return null;
  const atSite = assetsAtMars.filter(
    ({ landingSiteName }) => landingSiteName === homeward.siteName,
  );
  const crewed = homeward.aboard === "crew";
  // Those leaving stop being at Mars on the day the ascent flies, which picks them out from any others there.
  const craft = atSite.flatMap((asset, place): AscentCraft[] => {
    if (crewed) {
      if (asset.kind !== "crew") return [];
      const landers = crewLandersOf(asset.crew ?? []);
      const leaving = new Set(
        (asset.crew ?? [])
          .filter(({ untilDay }) => untilDay === moment.day)
          .map(({ arrivedOnDay }) => landers.indexOf(arrivedOnDay)),
      );
      return [...leaving]
        .toSorted((first, second) => first - second)
        .map((lander) => ({ name: asset.label, place, lander }));
    }
    return asset.kind === "ascent-vehicle" && asset.untilDay === moment.day
      ? [{ name: asset.label, place, lander: 0 }]
      : [];
  });
  if (craft.length === 0) return null;
  return {
    siteName: homeward.siteName,
    crewed,
    failed: moment.failed,
    // Only one ascent vehicle flies the samples.
    craft: crewed ? craft : craft.slice(0, 1),
  };
}

/** The Turn's Mars ascent and how long ago it started, which is past its length once it's over. */
export interface AscentNow {
  sequence: AscentSequence;
  elapsedMs: number;
}

/** Where the Turn's Mars ascent has got to, or null if it hasn't started. */
export function ascentNow(
  sequence: AscentSequence | null,
  homeward: Homeward | null,
  played: Pick<PlaybackState, "playedMs" | "entriesPlayedMs">,
): AscentNow | null {
  if (!sequence) return null;
  const started = homewardStarted(homeward, played, "ascent");
  return started ? { sequence, elapsedMs: started.sinceMs } : null;
}

export const ascentMs = homewardPlayMs.ascent;

export function ascentRunning(now: AscentNow | null): now is AscentNow {
  return now !== null && now.elapsedMs < ascentMs;
}

/** When the engine lights, kicking up dust, and when it lifts off. */
export const ignitionMs = 300;
export const liftOffMs = 900;

/** How long a successful ascent takes to climb out of the top of the shot, speeding up all the way. */
const climbMs = 4300;
const climbedAltitude = 11;

/** A failed ascent's engine cuts out, and it falls back and hits the ground. */
export const engineOutMs = 2300;
export const ascentImpactMs = 3700;

/** How far it has drifted to the side by the time it hits, and tipped over. */
const fallDrift = 0.8;
const fallTilt = 1.3;

function climbAltitude(ms: number): number {
  const share = Math.max(ms - liftOffMs, 0) / climbMs;
  return climbedAltitude * share * share;
}

/** What lifts off at a moment in the ascent: how high it is, how far it has drifted and tipped, and whether its engine is burning. */
export function riseAt(
  failed: boolean,
  elapsedMs: number,
): {
  altitude: number;
  drift: number;
  tilt: number;
  burning: boolean;
  impacted: boolean;
} {
  if (!failed || elapsedMs < engineOutMs) {
    const altitude = climbAltitude(elapsedMs);
    return {
      altitude,
      drift: 0,
      tilt: 0,
      burning: elapsedMs >= ignitionMs && altitude < climbedAltitude,
      impacted: false,
    };
  }
  // Coasting up a little on the speed it had, then falling back.
  const startHeight = climbAltitude(engineOutMs);
  const startSpeed =
    (2 * climbedAltitude * (engineOutMs - liftOffMs)) / climbMs ** 2;
  const fallingMs = ascentImpactMs - engineOutMs;
  const gravity = (2 * (startHeight + startSpeed * fallingMs)) / fallingMs ** 2;
  const sinceMs = Math.min(elapsedMs - engineOutMs, fallingMs);
  const share = sinceMs / fallingMs;
  return {
    altitude: Math.max(
      startHeight + startSpeed * sinceMs - (gravity * sinceMs * sinceMs) / 2,
      0,
    ),
    drift: fallDrift * share * share,
    tilt: fallTilt * share,
    burning: false,
    impacted: elapsedMs >= ascentImpactMs,
  };
}

/** Which of the four ascent sequences this is, as the browser tests read it. */
export function ascentKind({
  crewed,
  failed,
}: Pick<AscentSequence, "crewed" | "failed">):
  "ascent" | "ascent-crash" | "crew-ascent" | "crew-ascent-crash" {
  const what = failed ? "ascent-crash" : "ascent";
  return crewed ? `crew-${what}` : what;
}

/** What the player reads about a Mars ascent running at a Landing Site. */
export function ascentStatus(
  now: AscentNow | null,
  siteName: string,
): string | null {
  if (!ascentRunning(now) || now.sequence.siteName !== siteName) return null;
  const { craft, crewed, failed } = now.sequence;
  const names = [...new Set(craft.map(({ name }) => name))].join(", ");
  const what = failed ? "Mars ascent failed" : "Mars ascent";
  return `${crewed ? "Crew " : ""}${what}: ${names}`;
}

/**
 * The Landing Sites to choose between during Mars ascent. What lifts off stops operating as it does, so without this
 * the surface view could lose the site while the ascent is playing. It goes first, for the camera to show it.
 */
export function sitesDuringAscent(
  sites: readonly string[],
  now: AscentNow | null,
): readonly string[] {
  if (!ascentRunning(now)) return sites;
  return [...new Set([now.sequence.siteName, ...sites])];
}
