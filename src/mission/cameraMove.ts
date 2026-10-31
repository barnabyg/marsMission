import type { CameraPose, Point } from "./sceneParts";

const moveMs = 1000;

/** Longest step for one frame, so that a stutter slows a move down instead of jumping it forward. */
const longestStepMs = 100;

/** A camera move in progress, or finished once all its time has passed. */
export interface CameraMove {
  from: CameraPose;
  to: CameraPose;
  elapsedMs: number;
}

export function settledAt(pose: CameraPose): CameraMove {
  return { from: pose, to: pose, elapsedMs: moveMs };
}

function between(from: Point, to: Point, share: number): Point {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/** Where the camera is now. Position and target share one curve, so the view never swings past straight down. */
export function poseDuring({ from, to, elapsedMs }: CameraMove): CameraPose {
  if (elapsedMs >= moveMs) return to;
  const progress = elapsedMs / moveMs;
  const eased = progress * progress * (3 - 2 * progress);
  return {
    position: between(from.position, to.position, eased),
    target: between(from.target, to.target, eased),
  };
}

/** Starts a new move from wherever the camera has got to, even partway through another. */
export function headFor(move: CameraMove, to: CameraPose): CameraMove {
  return { from: poseDuring(move), to, elapsedMs: 0 };
}

export function advanceMove(move: CameraMove, realMs: number): CameraMove {
  return {
    ...move,
    elapsedMs: move.elapsedMs + Math.min(realMs, longestStepMs),
  };
}
