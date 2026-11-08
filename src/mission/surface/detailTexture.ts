import { noise } from "./siteNoise";
import { toSun } from "./terrain";

/**
 * The fine grain drawn over the ground near the camera, where the terrain's vertices are too far apart to show it:
 * grit, pebbles and small bumps, lit from the same low Sun as the land. It's the same at every Landing Site, and
 * repeats across the ground, so it tiles without a seam. Each texel scales the ground's colour, 128 leaving it as it
 * is, below that darkening it and above lightening it.
 */

/** Texels along each side of the square. */
export const detailTextureSize = 128;

const seed = 0x2f6b9d3;

/** The height of the grain at a texel, which wraps around at the square's edges. */
function grainHeight(column: number, row: number): number {
  const size = detailTextureSize;
  const octave = (cells: number, weight: number, offset: number) =>
    (noise(
      seed + offset,
      (column / size) * cells,
      (row / size) * cells,
      cells,
    ) -
      0.5) *
    weight;
  // Pebbles: the highest part of a fine noise, standing out of the ground.
  const pebbles = Math.max(
    noise(seed + 9, (column / size) * 24, (row / size) * 24, 24) - 0.62,
    0,
  );
  return (
    octave(6, 1.4, 0) +
    octave(12, 1, 1) +
    octave(32, 0.6, 2) +
    octave(64, 0.35, 3) +
    pebbles * 5
  );
}

/** One value for each texel, row by row along z, each row along x, as a texture laid on the ground at y = 0 reads them. */
export function detailTexels(): Uint8Array {
  const size = detailTextureSize;
  const wrap = (value: number) => (value + size) % size;
  const heights = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      heights[row * size + column] = grainHeight(column, row);
    }
  }
  const height = (column: number, row: number) =>
    heights[wrap(row) * size + wrap(column)] ?? 0;
  const flatLight = toSun.y;
  const texels = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const normal = {
        x: height(column - 1, row) - height(column + 1, row),
        y: 0.6,
        z: height(column, row - 1) - height(column, row + 1),
      };
      const length = Math.hypot(normal.x, normal.y, normal.z);
      const light =
        Math.max(
          (normal.x * toSun.x + normal.y * toSun.y + normal.z * toSun.z) /
            length,
          0,
        ) - flatLight;
      // A little speckle of lighter and darker grains, whatever their slope.
      const speckle = (noise(seed + 11, column, row, size) - 0.5) * 0.15;
      texels[row * size + column] = Math.round(
        Math.min(Math.max(128 + (light * 0.9 + speckle) * 128, 0), 255),
      );
    }
  }
  return texels;
}
