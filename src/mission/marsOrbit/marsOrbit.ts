import type { Timeline } from "../../simulation/simulation";
import { assetsAtMarsOn } from "../journey";
import type { Point } from "../sceneParts";

/** How far an orbiter is from the middle of Mars, whose radius is 1 in this view. */
export const orbitRadius = 1.7;

/** Deliberately slow, because the true rate would be a blur at these speeds. */
const orbitRadiansPerDay = 0.08;

/** Spaces out any number of orbiters without moving those already there when another arrives. */
const goldenAngle = 2.39996;

interface Orbiter {
  name: string;
  /** Its place among the Turn's Assets at Mars, which stays the same all Turn. */
  slot: number;
}

/** The Assets going round Mars on a given day. */
export function orbitersOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): Orbiter[] {
  return assetsAtMarsOn(timeline, day)
    .filter((asset) => asset.landingSiteName === null)
    .map((asset) => ({
      name: asset.name,
      slot: timeline.assetsAtMars.indexOf(asset),
    }));
}

/** Where an orbiter is, relative to the middle of Mars. */
export function orbiterPosition(slot: number, day: number): Point {
  const angle = day * orbitRadiansPerDay + slot * goldenAngle;
  return [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius];
}
