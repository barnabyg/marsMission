import type { Timeline } from "../../simulation/simulation";
import { viewAskedForBy } from "../missionViews";
import { msSinceEntry, type PlaybackState } from "../playback";
import { crewLandersOf, modelOf, type SurfaceModel } from "./surface";

/**
 * A landing or crash takes this long in real time, leaving out pauses, at every speed. At 20x a span
 * of game days would flash by, and at 1x the same span would drag, so this is the one thing in Mission
 * Mode that doesn't go by the day. It only displays the Timeline, and it starts from the moment
 * playback reaches the landing's entry, so it can't change any results.
 */
export const sequenceMs = 7000;

/** Where the descent starts from, above the top of the shot. */
const startAltitude = 8;

/** Enough time for a good look at a landing, then for the dust to clear. */
export const touchdownMs = 5000;

/** Sooner than a landing, as nothing is slowing it down. */
export const impactMs = 2600;

const greatestTilt = 0.9;

interface SequenceAsset {
  name: string;
  model: SurfaceModel;
  /** Where it comes down among the Assets at the site. */
  place: number;
  /** Which of the landers in its place it is, which is only ever more than 0 for Crew joining Crew already there. */
  lander: number;
}

/** The landing or crash in a Turn. There's at most one, as a Turn has at most one Mission, going to one Landing Site. */
export interface LandingSequence {
  siteName: string;
  /** The same day as its entry in the events column. */
  day: number;
  crashed: boolean;
  /** Whether Crew are coming down, which makes it a Crew landing or a Crew crash. */
  crewed: boolean;
  /** Which of the Timeline's entries sets it off. */
  entryIndex: number;
  assets: SequenceAsset[];
}

/** The Turn's landing or crash, if it has one. A Mission lost before it gets there has no entry for it, so no sequence. */
export function landingSequenceOf({
  mission,
  assetsAtMars,
  entries,
}: Pick<
  Timeline,
  "assetsAtMars" | "mission" | "entries"
>): LandingSequence | null {
  // Mars ascent asks for the surface too, but it plays as a sequence of its own (ascent.ts).
  const entryIndex = entries.findIndex(
    (entry) =>
      viewAskedForBy(entry) === "surface" &&
      !(entry.kind === "missionEvent" && entry.homeward),
  );
  const entry = entries[entryIndex];
  if (entry?.kind !== "missionEvent") return null;
  const landing = (mission?.assets ?? []).filter(
    ({ landingSiteName }) => landingSiteName !== null,
  );
  const siteName = landing[0]?.landingSiteName ?? null;
  if (siteName === null) return null;
  const atSite = assetsAtMars.filter(
    ({ landingSiteName }) => landingSiteName === siteName,
  );
  return {
    siteName,
    day: entry.day,
    crashed: entry.outcome === "failure",
    crewed: landing.some(({ kind }) => kind === "crew"),
    entryIndex,
    assets: landing.map(({ name, kind, deliveredOnDay }, index) => {
      const crashedPlace = { place: atSite.length + index, lander: 0 };
      if (deliveredOnDay === null) {
        return { name, model: modelOf(kind), ...crashedPlace };
      }
      if (kind === "crew") {
        // Crew landing where Crew already are join them, in their place, so there's only ever one such place.
        const place = atSite.findIndex((asset) => asset.kind === "crew");
        const landers = crewLandersOf(atSite[place]?.crew ?? []);
        return {
          name,
          model: modelOf(kind),
          place,
          lander: Math.max(landers.indexOf(deliveredOnDay), 0),
        };
      }
      return {
        name,
        model: modelOf(kind),
        place: atSite.findIndex(
          (asset) =>
            asset.name === name && asset.arrivedOnDay === deliveredOnDay,
        ),
        lander: 0,
      };
    }),
  };
}

/** A Turn's sequence and how long ago it started, which is past its length once it's over. */
export interface SequenceNow {
  sequence: LandingSequence;
  elapsedMs: number;
}

/** Where the Turn's sequence has got to, or null if it hasn't started. */
export function sequenceNow(
  sequence: LandingSequence | null,
  playback: Pick<PlaybackState, "playedMs" | "entriesPlayedMs">,
): SequenceNow | null {
  if (!sequence) return null;
  const elapsedMs = msSinceEntry(playback, sequence.entryIndex);
  return elapsedMs === null ? null : { sequence, elapsedMs };
}

export function sequenceRunning(now: SequenceNow | null): now is SequenceNow {
  return now !== null && now.elapsedMs < sequenceMs;
}

export function hasImpacted({ sequence, elapsedMs }: SequenceNow): boolean {
  return sequence.crashed && elapsedMs >= impactMs;
}

/** How high what's coming down is, and how far it has tipped over. */
export function fallAt(
  crashed: boolean,
  elapsedMs: number,
): { altitude: number; tilt: number } {
  if (crashed) {
    const share = Math.min(elapsedMs / impactMs, 1);
    return {
      altitude: startAltitude * (1 - share * share),
      tilt: greatestTilt * share,
    };
  }
  // Slowing down all the way, as its engines fight the fall.
  const left = 1 - Math.min(elapsedMs / touchdownMs, 1);
  return { altitude: startAltitude * left * left * left, tilt: 0 };
}

/**
 * The Landing Sites to choose between during a crash. Nothing operates at a crash site, so without
 * this the surface view would vanish while the crash is playing. It goes first, for the camera to
 * show it, and it's gone when the sequence ends, when the view moves on as it would for any other
 * site with nothing left to show.
 */
export function sitesDuring(
  sites: readonly string[],
  now: SequenceNow | null,
): readonly string[] {
  if (!sequenceRunning(now) || !now.sequence.crashed) return sites;
  return [...new Set([now.sequence.siteName, ...sites])];
}

/** Which of the four sequences this is, as the browser tests read it. */
export function sequenceKind({
  crashed,
  crewed,
}: Pick<LandingSequence, "crashed" | "crewed">):
  "landing" | "crash" | "crew-landing" | "crew-crash" {
  const what = crashed ? "crash" : "landing";
  return crewed ? `crew-${what}` : what;
}

/** What the player reads about a sequence running at a Landing Site. */
export function sequenceStatus(
  now: SequenceNow | null,
  siteName: string,
): string | null {
  if (!sequenceRunning(now) || now.sequence.siteName !== siteName) return null;
  const { assets, crashed, crewed } = now.sequence;
  const names = assets.map(({ name }) => name).join(", ");
  const what = crashed ? "crash" : "landing";
  return `${crewed ? "Crew " : ""}${what}: ${names}`.replace(/^./, (first) =>
    first.toUpperCase(),
  );
}
