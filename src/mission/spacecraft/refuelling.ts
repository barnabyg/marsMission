import type { TimelineEntry } from "../../simulation/simulation";
import { msSinceEntry, type PlaybackState } from "../playback";
import type { Point } from "../sceneParts";

/** A Mission Event of Orbital refuelling: which of the Timeline's entries it is, and whether it failed. */
interface Moment {
  entryIndex: number;
  failed: boolean;
}

/** A Mission's Orbital refuelling, as its Timeline has it. */
export interface Refuelling {
  /** The Mission's launch, which puts it in Earth orbit. */
  launchIndex: number;
  tankerLaunch: Moment;
  /** Null if the tanker launch failed, as the Tanker never gets there. */
  rendezvous: Moment | null;
  /** The day of the Mars transfer burn, or null if the Mission never gets that far or the Timeline stops before it. */
  departureDay: number | null;
}

/** How far playback has got, which is all these need of it. */
type Played = Pick<
  PlaybackState,
  "day" | "entriesHappened" | "playedMs" | "entriesPlayedMs"
>;

function momentOf(
  entries: readonly TimelineEntry[],
  eventId: string,
): Moment | null {
  const entryIndex = entries.findIndex(
    (entry) => entry.kind === "missionEvent" && entry.eventId === eventId,
  );
  const entry = entries[entryIndex];
  return entry?.kind === "missionEvent"
    ? { entryIndex, failed: entry.outcome === "failure" }
    : null;
}

/** The Turn's Orbital refuelling, or null if its Mission has none or never got into orbit. */
export function refuellingOf(
  entries: readonly TimelineEntry[],
): Refuelling | null {
  const launch = momentOf(entries, "launch");
  const tankerLaunch = momentOf(entries, "tanker-launch");
  if (!launch || !tankerLaunch) return null;
  // A Decision Point on the burn comes before it, on the same day.
  const departure = entries.find(
    (entry) =>
      (entry.kind === "missionEvent" || entry.kind === "decisionPoint") &&
      entry.eventId === "mars-transfer-burn",
  );
  return {
    launchIndex: launch.entryIndex,
    tankerLaunch,
    rendezvous: momentOf(entries, "rendezvous"),
    departureDay: departure?.day ?? null,
  };
}

/**
 * Orbital refuelling plays for these lengths of real time, leaving out pauses, at every speed, as days in Earth orbit
 * would flash by at 10x. It starts from the moment playback reaches each entry, and only displays the Timeline, so it
 * can't change any results.
 */
export const tankerClimbMs = 2500;
export const approachMs = 2500;
const transferMs = 2500;
/** A successful rendezvous ends with the Tanker leaving. A failed one shows the wreck for as long. */
export const rendezvousMs = 6500;
const leaveMs = rendezvousMs - approachMs - transferMs;
/** How long a wrecked Tanker takes to bounce clear. */
const bounceMs = 1500;

/**
 * - waiting: the Mission alone in orbit, before the Tanker launches
 * - tankerClimbing: the Tanker on its way up, which breaks up at the end of it if its launch failed
 * - tankerLost: the Mission stranded after the Tanker broke up
 * - holding: the Tanker nearby, waiting for the rendezvous
 * - approaching, refuelling, leaving: a successful rendezvous, with the Tanker docked to refuel
 * - collided: a failed rendezvous, from the moment they hit
 * - refuelled: the Mission alone again, before its Mars transfer burn
 */
type EarthOrbitStage =
  | "waiting"
  | "tankerClimbing"
  | "tankerLost"
  | "holding"
  | "approaching"
  | "refuelling"
  | "leaving"
  | "collided"
  | "refuelled";

/** What the spacecraft view shows in Earth orbit now. */
export interface EarthOrbitNow {
  stage: EarthOrbitStage;
  /** Whether the Mission is lost yet, which it is only once the moment that loses it has played. */
  missionLost: boolean;
  /** Real time played since the tanker launch, or null before it. */
  sinceTankerMs: number | null;
  /** Real time played since the rendezvous, or null before it. */
  sinceRendezvousMs: number | null;
  /** Whether the tanker launch failed. */
  tankerFailed: boolean;
  /** Whether the rendezvous failed. */
  rendezvousFailed: boolean;
}

function stageOf(
  {
    tankerFailed,
    rendezvousFailed,
    sinceTankerMs,
    sinceRendezvousMs,
  }: Omit<EarthOrbitNow, "stage" | "missionLost">,
  departed: boolean,
): EarthOrbitStage | null {
  if (sinceTankerMs === null) return "waiting";
  if (tankerFailed) {
    if (sinceTankerMs < tankerClimbMs) return "tankerClimbing";
    return sinceTankerMs < rendezvousMs ? "tankerLost" : null;
  }
  if (sinceRendezvousMs === null) {
    return sinceTankerMs < tankerClimbMs ? "tankerClimbing" : "holding";
  }
  if (sinceRendezvousMs < approachMs) return "approaching";
  if (sinceRendezvousMs >= rendezvousMs) {
    return rendezvousFailed || departed ? null : "refuelled";
  }
  if (rendezvousFailed) return "collided";
  return sinceRendezvousMs < approachMs + transferMs ? "refuelling" : "leaving";
}

/**
 * The Mission in Earth orbit now, or null if it isn't there: before launch, or once Orbital refuelling has played and
 * the Mission has left for Mars or been lost.
 */
export function earthOrbitNow(
  refuelling: Refuelling | null,
  played: Played,
): EarthOrbitNow | null {
  if (!refuelling) return null;
  if (msSinceEntry(played, refuelling.launchIndex) === null) return null;
  const { tankerLaunch, rendezvous, departureDay } = refuelling;
  const timing = {
    sinceTankerMs: msSinceEntry(played, tankerLaunch.entryIndex),
    sinceRendezvousMs: rendezvous
      ? msSinceEntry(played, rendezvous.entryIndex)
      : null,
    tankerFailed: tankerLaunch.failed,
    rendezvousFailed: rendezvous?.failed ?? false,
  };
  const stage = stageOf(
    timing,
    departureDay !== null && played.day >= departureDay,
  );
  if (stage === null) return null;
  return {
    stage,
    missionLost: stage === "tankerLost" || stage === "collided",
    ...timing,
  };
}

/**
 * Where the Tanker goes, from its docking port on the Mission. Along the Mission is x, so it comes in from beyond the
 * end of it, up is y, and z is towards the camera.
 */
const docked: Point = [0, 0, 0];
/** Below the shot, coming up from Earth. */
const climbStart: Point = [-3.4, -4.6, -1.8];
const holdingPlace: Point = [-2.2, 0.7, -0.8];
/** How far along its climb a Tanker gets before it breaks up, if its launch failed. */
const breakUpShare = 0.6;
const bounceEnd: Point = [-1.6, 1, -0.6];
const leaveEnd: Point = [-2.8, -0.6, 0.9];

function between(from: Point, to: Point, share: number): Point {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/** Eases in and out, from 0 to 1 over the time given. */
function eased(ms: number, overMs: number): number {
  const share = Math.min(Math.max(ms / overMs, 0), 1);
  return share * share * (3 - 2 * share);
}

function climbPlace(sinceTankerMs: number, failed: boolean): Point {
  const share = eased(sinceTankerMs, tankerClimbMs);
  return between(
    climbStart,
    holdingPlace,
    failed ? share * breakUpShare : share,
  );
}

/** The Tanker now, from its docking port on the Mission, or null when it isn't there to show. */
export function tankerAt(
  now: EarthOrbitNow | null,
): { place: Point; burning: boolean; lost: boolean } | null {
  if (now?.sinceTankerMs == null) return null;
  const { stage, sinceTankerMs } = now;
  const sinceRendezvousMs = now.sinceRendezvousMs ?? 0;
  const climbed = climbPlace(sinceTankerMs, now.tankerFailed);
  switch (stage) {
    case "tankerClimbing":
      return { place: climbed, burning: true, lost: false };
    case "holding":
      return { place: climbed, burning: false, lost: false };
    case "approaching": {
      const share = sinceRendezvousMs / approachMs;
      // Coming in too fast is what goes wrong, so a failed one never slows down.
      const closed = now.rendezvousFailed ? share * share : eased(share, 1);
      return {
        place: between(climbed, docked, closed),
        burning: true,
        lost: false,
      };
    }
    case "refuelling":
      return { place: docked, burning: false, lost: false };
    case "leaving": {
      const left = eased(sinceRendezvousMs - approachMs - transferMs, leaveMs);
      return {
        place: between(docked, leaveEnd, left),
        burning: true,
        lost: false,
      };
    }
    case "collided": {
      const bounced =
        1 - (1 - Math.min((sinceRendezvousMs - approachMs) / bounceMs, 1)) ** 2;
      return {
        place: between(docked, bounceEnd, bounced),
        burning: false,
        lost: true,
      };
    }
    default:
      return null;
  }
}

/** Real time played since the Mission was lost in Earth orbit, by a collision or the Tanker breaking up, or null if it hasn't been. */
export function msSinceLoss(now: EarthOrbitNow | null): number | null {
  if (now?.stage === "collided") {
    return (now.sinceRendezvousMs ?? 0) - approachMs;
  }
  if (now?.stage === "tankerLost")
    return (now.sinceTankerMs ?? 0) - tankerClimbMs;
  return null;
}

/** How long the flash lasts when the Mission is lost in Earth orbit. */
const flashMs = 900;

/** The flash where the Mission was just lost, and how far it has faded from 0 to 1, or null if there's none to show. */
export function lossFlash(
  now: EarthOrbitNow | null,
): { place: Point; share: number } | null {
  const since = msSinceLoss(now);
  if (since === null || since >= flashMs) return null;
  const place =
    now?.stage === "collided"
      ? docked
      : between(climbStart, holdingPlace, breakUpShare);
  return { place, share: since / flashMs };
}

const statuses: Record<EarthOrbitStage, string> = {
  waiting: "Waiting in Earth orbit for the Tanker",
  tankerClimbing: "Tanker launch: the Tanker is climbing to orbit",
  tankerLost: "Tanker launch failed: the Mission is stranded in Earth orbit",
  holding: "The Tanker is in orbit nearby, ready for the Rendezvous",
  approaching: "Rendezvous: the Tanker is coming in to dock",
  refuelling: "Orbital refuelling: taking on propellant from the Tanker",
  leaving: "Orbital refuelling done: the Tanker is pulling away",
  collided: "Rendezvous failed: the Mission and the Tanker collided",
  refuelled: "Refuelled, and ready for the Mars transfer burn",
};

/** What the player reads about the Mission in Earth orbit, or null if it isn't there. */
export function earthOrbitStatus(now: EarthOrbitNow | null): string | null {
  return now ? statuses[now.stage] : null;
}
