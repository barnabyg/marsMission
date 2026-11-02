/** Fixed, so that a solar particle event costs the same at every moment on a machine drawing 4K by software. */
export const particleCount = 320;

/** The box the particles stream through, around the spacecraft, along the stack and across it. */
const along = 12;
const high = 6;
const deep = 5;

/** How far each particle drops for every unit it travels along, so that the stream slants down across the shot. */
const slant = 0.3;

/** The same share from 0 to 1 for the same particle and purpose. */
function shareFor(particle: number, purpose: number): number {
  const value = Math.sin(particle * 127.1 + purpose * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Where each particle of a solar particle event is after this many seconds: streaming fast past the spacecraft and
 * round again. It depends only on the time, and is written into `positions` to save making anything new on each frame.
 */
export function writeParticleStream(
  positions: Float32Array,
  seconds: number,
): void {
  for (let particle = 0; particle < particleCount; particle++) {
    const speed = 5 + shareFor(particle, 0) * 4;
    const travelled = (shareFor(particle, 1) * along + seconds * speed) % along;
    positions[particle * 3] = travelled - along / 2;
    positions[particle * 3 + 1] =
      (shareFor(particle, 2) - 0.5) * high - (travelled - along / 2) * slant;
    positions[particle * 3 + 2] = (shareFor(particle, 3) - 0.6) * deep;
  }
}
