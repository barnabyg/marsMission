import type { AssetAtMars } from "../../simulation/simulation";
import { hashOf } from "./shaping";

/** What decides how a rover moves. */
export type RoverAtWork = Pick<
  AssetAtMars,
  "surfaceMotion" | "key" | "arrivedOnDay" | "fromDay" | "untilDay"
>;

interface Place {
  x: number;
  z: number;
}

/** Where a rover is on the ground, and which way its front points, as a turn about the vertical. */
export interface RoverSpot extends Place {
  heading: number;
}

/**
 * How long a rover stands where it landed. Long enough at 10x for the landing to have finished on
 * screen before it moves, and a rover does take a while to get going.
 */
const daysBeforeDrivingOff = 30;

/** About one lap of a Long traverse in a third of a Turn, which reads as moving at 1x and isn't frantic at 10x. */
const traverseUnitsPerDay = 0.05;

/** A small circle, taking a couple of months, for working in one place. */
const nearbyRadius = 0.28;
const nearbyRadiansPerDay = 0.1;

/** How far round a loop the landing spot is from straight out from the loop's middle, on each axis. */
const startShare = Math.SQRT1_2;

/** A share from 0 to 1 that depends only on the key and which share this is. */
function shareOf(hash: number, which: number): number {
  return ((hash >>> (which * 8)) & 0xff) / 255;
}

function loopAt(
  { x: middleX, z: middleZ }: Place,
  radiusX: number,
  radiusZ: number,
  angle: number,
  direction: number,
): RoverSpot {
  return {
    x: middleX + Math.cos(angle) * radiusX,
    z: middleZ + Math.sin(angle) * radiusZ,
    // The way it's going round the loop, as a turn from pointing along x, where +z is a turn backwards.
    heading: Math.atan2(
      -Math.cos(angle) * radiusZ * direction,
      -Math.sin(angle) * radiusX * direction,
    ),
  };
}

/**
 * A loop through the landing spot. It goes to the outside of the shot from the two middle places, to
 * keep clear of what's beside it, and otherwise inwards and towards the camera, to stay on the terrain.
 */
function traverse(hash: number, anchor: Place, days: number): RoverSpot {
  const radiusX = 1.3 + shareOf(hash, 0) * 0.5;
  const radiusZ = 2 + shareOf(hash, 1) * 0.8;
  const outwards = anchor.x < 0 ? -1 : 1;
  const across = Math.abs(anchor.x) <= 3 ? outwards : -outwards;
  const along = anchor.z <= 6 ? 1 : -1;
  const direction = shareOf(hash, 2) < 0.5 ? 1 : -1;
  const startAngle = Math.atan2(-along, -across);
  const radiansPerDay =
    traverseUnitsPerDay / Math.sqrt((radiusX ** 2 + radiusZ ** 2) / 2);
  return loopAt(
    {
      x: anchor.x + across * radiusX * startShare,
      z: anchor.z + along * radiusZ * startShare,
    },
    radiusX,
    radiusZ,
    startAngle + direction * radiansPerDay * days,
    direction,
  );
}

/** A small circle through the landing spot. */
function nearby(hash: number, anchor: Place, days: number): RoverSpot {
  const startAngle = shareOf(hash, 0) * Math.PI * 2;
  const direction = shareOf(hash, 2) < 0.5 ? 1 : -1;
  return loopAt(
    {
      x: anchor.x - Math.cos(startAngle) * nearbyRadius,
      z: anchor.z - Math.sin(startAngle) * nearbyRadius,
    },
    nearbyRadius,
    nearbyRadius,
    startAngle + direction * nearbyRadiansPerDay * days,
    direction,
  );
}

/**
 * Where a rover is on a given day. It goes by the rover's total days at Mars, so that it carries on
 * next Turn from where it had got to, and it stops moving on the day it stops operating.
 */
export function roverSpot(
  rover: RoverAtWork,
  anchor: Place,
  day: number,
): RoverSpot {
  if (rover.surfaceMotion === "still") return { ...anchor, heading: 0 };
  const lastDay = Math.min(day, rover.untilDay ?? day);
  const days = Math.max(
    Math.max(lastDay, rover.fromDay) -
      rover.arrivedOnDay -
      daysBeforeDrivingOff,
    0,
  );
  const hash = hashOf(rover.key);
  return rover.surfaceMotion === "traverse"
    ? traverse(hash, anchor, days)
    : nearby(hash, anchor, days);
}
