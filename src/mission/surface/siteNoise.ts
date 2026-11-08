import { smooth } from "./shaping";

/** Noise for a Landing Site's ground, from a seed alone, so that a site looks the same every time. */

/** A value from 0 to 1 that depends only on the seed and a place on a grid. */
export function latticeValue(seed: number, x: number, z: number): number {
  let hash = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 2 ** 32;
}

/**
 * Smooth noise from about 0 to 1, with features about 1 unit apart. Given a `period`, it repeats every that many
 * units, so that a texture made from it tiles.
 */
export function noise(seed: number, x: number, z: number, period = 0): number {
  const [left, back] = [Math.floor(x), Math.floor(z)];
  const [across, along] = [smooth(x - left), smooth(z - back)];
  const wrap = (value: number) =>
    period > 0 ? ((value % period) + period) % period : value;
  const at = (atX: number, atZ: number) =>
    latticeValue(seed, wrap(atX), wrap(atZ));
  const near = at(left, back) * (1 - across) + at(left + 1, back) * across;
  const far =
    at(left, back + 1) * (1 - across) + at(left + 1, back + 1) * across;
  return near * (1 - along) + far * along;
}
