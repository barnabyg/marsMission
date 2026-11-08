import { hashOf, smooth } from "./shaping";
import { latticeValue, noise } from "./siteNoise";

/** Terrain for a Landing Site, worked out from its name alone, so that a site looks the same every time. */

/** How far the terrain goes from the middle of the shot, in the scene's units. */
export const terrainReach = 13;

/** Keeps the vertex count modest, as this is drawn by software on some machines at 4K. */
const segments = 96;

/** Low, so that the slopes show up. Pointing from the ground towards the Sun, and of length 1. */
export const toSun = { x: -0.8, y: 0.45, z: 0.4 } as const;

/** The colour the land and the sky meet at, as linear red, green and blue. */
export const horizonColor = [0.62, 0.37, 0.22] as const;

const dustColor = [0.5, 0.2, 0.09] as const;
const rockColor = [0.3, 0.12, 0.06] as const;
/** Dark grey volcanic rock showing through the dust in patches. */
export const basaltColor = [0.17, 0.12, 0.1] as const;
/** Fine dust gathered in hollows, paler than the ground around it. */
export const paleDustColor = [0.64, 0.31, 0.15] as const;

/** Rolling ground plus smaller bumps, centred on 0. */
function hills(seed: number, x: number, z: number): number {
  return (
    (noise(seed, x * 0.11, z * 0.11) - 0.5) * 2.4 +
    (noise(seed + 1, x * 0.31, z * 0.31) - 0.5) * 0.8 +
    (noise(seed + 2, x * 0.9, z * 0.9) - 0.5) * 0.28
  );
}

const craterCount = 7;
const smallCraterCount = 24;

interface Crater {
  x: number;
  z: number;
  radius: number;
}

/**
 * Each site's craters, kept clear of the middle where the Assets stand: a few big ones, then many small ones, which
 * are deeper for their size, as young craters are.
 */
function cratersOf(seed: number): Crater[] {
  const crater = (index: number, nearest: number, spread: number) => {
    const angle = latticeValue(seed, index, 1) * Math.PI * 2;
    const distance = nearest + latticeValue(seed, index, 2) * spread;
    return {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
    };
  };
  const big = Array.from({ length: craterCount }, (_, index) => ({
    ...crater(index, 5.5, 6),
    radius: 0.7 + latticeValue(seed, index, 3) * 1.4,
  }));
  const small = Array.from({ length: smallCraterCount }, (_, count) => {
    const index = craterCount + count;
    return {
      ...crater(index, 3.6, 8.5),
      radius: 0.2 + latticeValue(seed, index, 3) ** 2 * 0.4,
    };
  });
  return [...big, ...small];
}

/** A bowl with a raised rim. */
function craterDepth({ x, z, radius }: Crater, atX: number, atZ: number) {
  const across = Math.hypot(atX - x, atZ - z) / radius;
  if (across > 1.6) return 0;
  const bowl = across < 1 ? -(1 - across * across) * 0.45 : 0;
  const rim = 0.16 * Math.exp(-((across - 1) ** 2) / 0.04);
  return (bowl + rim) * radius * 0.6;
}

/**
 * Low ridges of wind-blown sand, long across the wind and close together along it, with a fine roughness over them.
 * Centred near 0, and about a tenth of a unit high.
 */
function ridges(seed: number, x: number, z: number): number {
  const along = x * 0.8 + z * 0.6;
  const across = z * 0.8 - x * 0.6;
  const ridge =
    1 - Math.abs(noise(seed + 4, along * 1.7, across * 0.35) * 2 - 1);
  return (
    (ridge ** 3 - 0.25) * 0.075 +
    (noise(seed + 5, x * 2.3, z * 2.3) - 0.5) * 0.06
  );
}

function heightOf(seed: number, craters: Crater[], x: number, z: number) {
  // Nearly level in the middle, so that the Assets stand on open ground.
  const open = 0.08 + 0.92 * smooth((Math.hypot(x, z) - 3) / 5);
  return (
    (hills(seed, x, z) + ridges(seed, x, z)) * open +
    craters.reduce((sum, crater) => sum + craterDepth(crater, x, z), 0)
  );
}

/** Each site's craters once worked out, as the rovers ask for the height of the ground every frame. */
const cratersBySeed = new Map<number, Crater[]>();

function knownCraters(seed: number): Crater[] {
  const known = cratersBySeed.get(seed);
  if (known) return known;
  const craters = cratersOf(seed);
  cratersBySeed.set(seed, craters);
  return craters;
}

/** How high the ground is at a place in the shot. */
export function groundHeight(siteName: string, x: number, z: number): number {
  const seed = hashOf(siteName);
  return heightOf(seed, knownCraters(seed), x, z);
}

/** The arrays for a terrain mesh, with how strongly its fine grain shows at each vertex. Its light is worked into the colours, as a light in the shared scene would also fall on the other views. */
export function buildTerrain(siteName: string) {
  const seed = hashOf(siteName);
  const craters = cratersOf(seed);
  const across = segments + 1;
  const positions = new Float32Array(across * across * 3);
  const colors = new Float32Array(across * across * 3);
  /** How strongly the fine grain is drawn on each vertex, from 1 near the camera to 0 well before the edge. */
  const detail = new Float32Array(across * across);
  const height = (x: number, z: number) => heightOf(seed, craters, x, z);
  // Closer together towards the middle, where the camera looks.
  const spread = (share: number) =>
    terrainReach * (0.3 * share + 0.7 * share * share * share);
  for (let row = 0; row < across; row++) {
    for (let column = 0; column < across; column++) {
      const vertex = (row * across + column) * 3;
      const x = spread((column / segments) * 2 - 1);
      const z = spread((row / segments) * 2 - 1);
      const y = height(x, z);
      positions[vertex] = x;
      positions[vertex + 1] = y;
      positions[vertex + 2] = z;

      const step = 0.15;
      const normal = {
        x: height(x - step, z) - height(x + step, z),
        y: 2 * step,
        z: height(x, z - step) - height(x, z + step),
      };
      const length = Math.hypot(normal.x, normal.y, normal.z);
      const light =
        0.35 +
        1.05 *
          Math.max(
            0,
            (normal.x * toSun.x + normal.y * toSun.y + normal.z * toSun.z) /
              length,
          );
      const rockiness = smooth((noise(seed + 3, x * 0.5, z * 0.5) - 0.35) * 3);
      const basalt =
        smooth((noise(seed + 6, x * 0.38, z * 0.38) - 0.58) * 4) * 0.85;
      // Dust settles in the hollows, where the ground is lower than around it.
      const hollow = (height(x - 0.4, z) + height(x + 0.4, z)) / 2 - y;
      const paleDust = smooth(
        hollow * 12 + (noise(seed + 7, x * 0.7, z * 0.7) - 0.6) * 2.5,
      );
      // The far edge fades into the sky.
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const fade = smooth((edge - 7) / (terrainReach - 7));
      detail[vertex / 3] = 1 - smooth((edge - 6) / 5);
      for (let channel = 0; channel < 3; channel++) {
        const ground =
          (dustColor[channel] ?? 0) * (1 - rockiness) +
          (rockColor[channel] ?? 0) * rockiness;
        const dusted =
          ground * (1 - paleDust) + (paleDustColor[channel] ?? 0) * paleDust;
        const land =
          (dusted * (1 - basalt) + (basaltColor[channel] ?? 0) * basalt) *
          light;
        colors[vertex + channel] =
          land * (1 - fade) + (horizonColor[channel] ?? 0) * fade;
      }
    }
  }

  const indices = new Uint16Array(segments * segments * 6);
  let next = 0;
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const corner = row * across + column;
      // Wound so that the top is the front.
      indices.set(
        [
          corner,
          corner + across,
          corner + 1,
          corner + 1,
          corner + across,
          corner + across + 1,
        ],
        next,
      );
      next += 6;
    }
  }
  return { positions, colors, detail, indices };
}
