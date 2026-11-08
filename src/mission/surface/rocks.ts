import { hashOf } from "./shaping";
import { latticeValue } from "./siteNoise";
import { standingSpots } from "./surface";
import { groundHeight, terrainReach } from "./terrain";

/** The stones and boulders lying about a Landing Site, worked out from its name alone, so they lie the same every time. */

export interface Rock {
  x: number;
  y: number;
  z: number;
  /** Its width, height and depth, in the scene's units. */
  size: [width: number, height: number, depth: number];
  /** How far it's turned about the up axis, in radians. */
  turn: number;
  /** How light it is, from 0 for the darkest basalt to 1 for the palest. */
  shade: number;
}

const stoneCount = 300;
const boulderCount = 9;

const clearance = 1.15;

/** Rocks stay in front of the camera, which stands about 7.5 units back from the middle of the shot,
 * and sees the ground from about 4 units in front of it. */
const nearestToCamera = -3.5;
const reach = terrainReach - 1;
const boulderReach = 8;

function isClear(x: number, z: number, size: number): boolean {
  return standingSpots.every(
    (spot) => Math.hypot(x - spot.x, z - spot.z) > clearance + size,
  );
}

/**
 * Each of a site's rocks: a few boulders and many small stones, most of them small. Each is half buried a third of its
 * height in the ground, turned its own way and shaded between dark basalt and paler dusty stone.
 */
export function rocksAt(siteName: string): Rock[] {
  const seed = hashOf(siteName) ^ 0x5bd1e995;
  const rocks: Rock[] = [];
  const wanted = stoneCount + boulderCount;
  for (let tried = 0; tried < wanted * 4 && rocks.length < wanted; tried++) {
    const value = (channel: number) => latticeValue(seed, tried, channel);
    const boulder = rocks.length < boulderCount;
    // Boulders lie nearer, where they show above the haze.
    const spread = boulder ? boulderReach : reach;
    const x = (value(0) * 2 - 1) * spread;
    const z = nearestToCamera + value(1) * (spread - nearestToCamera);
    const across = boulder
      ? 0.35 + value(2) * 0.4
      : 0.05 + value(2) ** 3 * 0.19;
    const size: Rock["size"] = [
      across,
      across * (0.45 + value(3) * 0.35),
      across * (0.7 + value(4) * 0.3),
    ];
    if (!isClear(x, z, across)) continue;
    rocks.push({
      x,
      y: groundHeight(siteName, x, z) - size[1] * 0.3,
      z,
      size,
      turn: value(5) * Math.PI * 2,
      shade: value(6),
    });
  }
  return rocks;
}
