import type { CameraPose, Point } from "../sceneParts";
import type { Homeward, HomewardNow } from "../homeward";

/**
 * The rendezvous in Mars orbit as the spacecraft view plays it: what lifted off through Mars ascent climbing up from
 * Mars to dock with what brings it home, or coming in too fast, hitting it and tumbling away. It goes by real time
 * played since the rendezvous started (`homeward.ts`), so it plays the same at every speed and holds while paused, and
 * it only displays the Timeline, so it can't change any results.
 */

/**
 * Mars orbit close up, opposite the Earth orbit shot across the middle of the scene, inside the stars and clear of every
 * other view. The solar system's Sun lights it from behind the camera.
 */
export const marsRendezvousCentre: Point = [20, 0, -8];

export const marsRendezvousShot: CameraPose = {
  position: [11.5, 2.2, -8],
  target: marsRendezvousCentre,
};

/** How long it takes to come in and dock, and how long a craft that hit takes to bounce clear. */
export const closingMs = 3200;
const bounceMs = 1800;

/**
 * - closing: what lifted off coming up to dock
 * - docked: joined, ready to leave for home
 * - missed: it hit and tumbled away, leaving those aboard stranded in Mars orbit
 */
type MarsRendezvousStage = "closing" | "docked" | "missed";

/** What the spacecraft view shows of the rendezvous now. */
export interface MarsRendezvousNow {
  stage: MarsRendezvousStage;
  /** Whether it brings Crew home, rather than samples. */
  crewed: boolean;
  /** What waits in Mars orbit to bring them home. */
  vehicleName: string;
  sinceMs: number;
  /** Whether it fails, coming in too fast, which shows before it hits. */
  failed: boolean;
}

/** The rendezvous while it plays, or null if it isn't playing. */
export function marsRendezvousNow(
  homeward: Pick<Homeward, "aboard" | "vehicleName"> | null,
  inSpace: HomewardNow | null,
): MarsRendezvousNow | null {
  if (!homeward || inSpace?.part !== "rendezvous") return null;
  const { sinceMs, failed } = inSpace;
  const stage = sinceMs < closingMs ? "closing" : failed ? "missed" : "docked";
  return {
    stage,
    crewed: homeward.aboard === "crew",
    vehicleName: homeward.vehicleName,
    sinceMs,
    failed,
  };
}

/**
 * Where things are in the rendezvous's own frame: along what waits is x, across the shot, up is y, and z is towards the
 * camera. What waits holds still a little left of the middle, its docking port facing +x, and what lifted off docks to
 * it nose first from the right.
 */
export const waitingAt: Point = [-0.6, 0, 0];
/** Where what lifted off docks, nose to nose with what waits: the Crew's cabin to their stage, or the samples' canister to the orbiter's capsule. */
export function dockedAt(crewed: boolean): Point {
  return [crewed ? 0.22 : 0.08, 0, 0];
}

/** Below the shot, climbing from Mars. */
const climbStart: Point = [3.6, -3.4, -1.4];
const bounceEnd: Point = [1.9, 1.3, 0.8];

function between(from: Point, to: Point, share: number): Point {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/** Where what lifted off is now, how far it has turned over, and whether its engine is firing. */
export function ascentCraftAt(now: MarsRendezvousNow): {
  place: Point;
  tumble: number;
  burning: boolean;
  lost: boolean;
} {
  const share = Math.min(now.sinceMs / closingMs, 1);
  const docked = dockedAt(now.crewed);
  if (now.stage === "closing") {
    // Braking all the way in to dock. Coming in too fast is what goes wrong, so a failed one never slows down.
    const closed = now.failed ? share * share : 1 - (1 - share) ** 3;
    return {
      place: between(climbStart, docked, closed),
      tumble: 0,
      burning: now.failed || share < 0.8,
      lost: false,
    };
  }
  if (now.stage === "docked") {
    return { place: docked, tumble: 0, burning: false, lost: false };
  }
  const bounced =
    1 - (1 - Math.min((now.sinceMs - closingMs) / bounceMs, 1)) ** 2;
  return {
    place: between(docked, bounceEnd, bounced),
    tumble: (now.sinceMs - closingMs) * 0.0012,
    burning: false,
    lost: true,
  };
}

/** How long the flash lasts where they hit. */
const flashMs = 700;

/** The flash where a failed rendezvous hit, and how far it has faded from 0 to 1, or null if there's none to show. */
export function hitFlash(
  now: MarsRendezvousNow | null,
): { place: Point; share: number } | null {
  if (now?.stage !== "missed") return null;
  const since = now.sinceMs - closingMs;
  return since < flashMs
    ? {
        place: [waitingAt[0] + 0.55, 0, 0],
        share: since / flashMs,
      }
    : null;
}

/** What the player reads about the rendezvous, or null if it isn't playing. */
export function marsRendezvousStatus(
  now: MarsRendezvousNow | null,
): string | null {
  if (!now) return null;
  const aboard = now.crewed ? "the Crew" : "the samples";
  switch (now.stage) {
    case "closing":
      return `Mars orbit rendezvous: ${aboard} coming up to dock with the ${now.vehicleName}`;
    case "docked":
      return `Mars orbit rendezvous: ${aboard} docked with the ${now.vehicleName}, ready to leave for home`;
    case "missed":
      return `Mars orbit rendezvous failed: ${aboard} couldn't dock with the ${now.vehicleName}`;
  }
}
