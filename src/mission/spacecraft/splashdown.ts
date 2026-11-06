import type { CameraPose, Point } from "../sceneParts";
import { homewardPlayMs, type Homeward, type HomewardNow } from "../homeward";

/**
 * Earth entry as the spacecraft view plays it: the capsule streaking down through the sky inside the glow of its entry,
 * slowing under its parachutes and splashing down in the ocean, or breaking up in the glow if its heat shield fails. It
 * goes by real time played since Earth entry started (`homeward.ts`), so it plays the same at every speed and holds
 * while paused, and it only displays the Timeline, so it can't change any results.
 */

/**
 * A patch of ocean of its own, with its own sky, high above the middle of the scene, where the other views' cameras
 * look away from it. Everything is unlit with its light worked into its colours, as at the surface.
 */
export const splashdownCentre: Point = [0, 20, 0];

/** Looking level across the ocean, with room above it for the capsule coming down. */
export const splashdownShot: CameraPose = {
  position: [0, 21.3, -7],
  target: [0, 22.3, 0],
};

/** When the parachutes open, when the capsule hits the water, and when a failed one breaks up. */
export const chutesOpenMs = 2600;
export const splashMs = 5200;
export const breakUpMs = 1900;

/**
 * - entering: streaking down inside the glow of entry
 * - descending: slowing under the parachutes
 * - splashedDown: floating in the ocean
 * - brokenUp: the heat shield failed, and it broke up in the glow
 */
type EarthEntryStage = "entering" | "descending" | "splashedDown" | "brokenUp";

export interface EarthEntryNow {
  stage: EarthEntryStage;
  /** Whether it brings Crew home, in a bigger capsule under three parachutes, rather than samples under one. */
  crewed: boolean;
  sinceMs: number;
}

/** Earth entry while it plays, or null if it isn't playing. */
export function earthEntryNow(
  homeward: Pick<Homeward, "aboard"> | null,
  inSpace: HomewardNow | null,
): EarthEntryNow | null {
  if (!homeward || inSpace?.part !== "entry") return null;
  const { sinceMs, failed } = inSpace;
  const stage: EarthEntryStage = failed
    ? sinceMs < breakUpMs
      ? "entering"
      : "brokenUp"
    : sinceMs < chutesOpenMs
      ? "entering"
      : sinceMs < splashMs
        ? "descending"
        : "splashedDown";
  return { stage, crewed: homeward.aboard === "crew", sinceMs };
}

/** Where the capsule comes in from, high in the sky to the left, where the parachutes open, and where it lands. */
const entryStart: Point = [-7.5, 9, 7];
const chutesAt: Point = [-1.6, 3.4, 3];
export const splashAt: Point = [0, 0, 2];

function between(from: Point, to: Point, share: number): Point {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/**
 * The capsule now, in the patch of ocean's own frame: where it is, how far it leans along its path, how bright the glow
 * of entry is, from 0 to 1, how far its parachutes are open, and whether it's still there to draw.
 */
export function capsuleAt(now: EarthEntryNow): {
  place: Point;
  lean: number;
  glow: number;
  chutes: number;
  shown: boolean;
} {
  const { sinceMs } = now;
  if (now.stage === "entering" || now.stage === "brokenUp") {
    const share = Math.min(sinceMs / chutesOpenMs, 1);
    // Slowing as the air thickens.
    const slowed = 1 - (1 - share) * (1 - share);
    const glow = Math.min(sinceMs / 400, 1) * (1 - share * 0.7);
    return {
      place: between(entryStart, chutesAt, slowed),
      lean: 0.9,
      glow,
      chutes: 0,
      shown: now.stage === "entering",
    };
  }
  if (now.stage === "descending") {
    const share = (sinceMs - chutesOpenMs) / (splashMs - chutesOpenMs);
    return {
      place: between(chutesAt, splashAt, share),
      lean: 0.9 * Math.max(1 - share * 4, 0),
      glow: 0,
      chutes: Math.min(share * 5, 1),
      shown: true,
    };
  }
  // Bobbing on the swell, with the parachutes falling away onto the water.
  const sinceSplashMs = sinceMs - splashMs;
  return {
    place: [
      splashAt[0],
      splashAt[1] + 0.05 * Math.sin(sinceSplashMs / 260),
      splashAt[2],
    ],
    lean: 0.08 * Math.sin(sinceSplashMs / 410),
    glow: 0,
    chutes: Math.max(1 - sinceSplashMs / 900, 0),
    shown: true,
  };
}

/** The pieces of a capsule that broke up, each thrown its own way and falling, from 0 just after to 1 when they're gone. */
export function piecesAt(now: EarthEntryNow): { place: Point; heat: number }[] {
  if (now.stage !== "brokenUp") return [];
  const share = Math.min(
    (now.sinceMs - breakUpMs) / (homewardPlayMs.entry - breakUpMs),
    1,
  );
  const from = capsuleAt({
    ...now,
    stage: "entering",
    sinceMs: breakUpMs,
  }).place;
  return [
    [1.8, 0.6, -0.4],
    [0.9, -1.2, 0.8],
    [2.6, -0.4, 0.3],
    [0.3, 0.2, -1.1],
  ].map(([x = 0, y = 0, z = 0]) => ({
    place: [
      from[0] + x * share * 2,
      from[1] + y * share * 2 - share * share * 3,
      from[2] + z * share * 2,
    ],
    heat: 1 - share,
  }));
}

/** How long the flash lasts where the capsule broke up. */
const flashMs = 700;

/** The flash where the capsule broke up, and how far it has faded from 0 to 1, or null if there's none to show. */
export function breakUpFlash(
  now: EarthEntryNow,
): { place: Point; share: number } | null {
  const since = now.sinceMs - breakUpMs;
  if (now.stage !== "brokenUp" || since >= flashMs) return null;
  const { place } = capsuleAt({
    ...now,
    stage: "entering",
    sinceMs: breakUpMs,
  });
  return { place, share: since / flashMs };
}

const statuses: Record<EarthEntryStage, string> = {
  entering:
    "Earth entry: the capsule is glowing as it comes into Earth's atmosphere",
  descending: "Earth entry: the capsule is coming down under its parachutes",
  splashedDown: "Earth entry: the capsule has splashed down in the ocean",
  brokenUp:
    "Earth entry failed: the capsule broke up as it came into Earth's atmosphere",
};

/** What the player reads about Earth entry, or null if it isn't playing. */
export function earthEntryStatus(now: EarthEntryNow | null): string | null {
  return now ? statuses[now.stage] : null;
}
