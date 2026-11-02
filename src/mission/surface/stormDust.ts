/** Fixed, so that a storm costs the same at every moment on a machine drawing 4K by software. */
export const dustCountInStorm = 260;

const across = 16;
const deep = 12;
const high = 4.5;

/** The same share from 0 to 1 for the same particle and purpose. */
function shareFor(particle: number, purpose: number): number {
  const value = Math.sin(particle * 127.1 + purpose * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Where each grain of dust is after this many seconds: blowing across the shot and round again, with a little rise and
 * fall. It depends only on the time, and is written into `positions` to save making anything new on each frame.
 */
export function writeStormDust(positions: Float32Array, seconds: number): void {
  for (let particle = 0; particle < dustCountInStorm; particle++) {
    const speed = 1.5 + shareFor(particle, 0) * 2.5;
    const travelled = shareFor(particle, 1) * across + seconds * speed;
    positions[particle * 3] = across / 2 - (travelled % across);
    positions[particle * 3 + 1] =
      shareFor(particle, 2) * high +
      Math.sin(seconds * speed + particle) * 0.15;
    positions[particle * 3 + 2] = (shareFor(particle, 3) - 0.5) * deep;
  }
}
