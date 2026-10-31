import { fallAt, impactMs, sequenceMs, touchdownMs } from "./sequence";

/** Fixed, so that a sequence costs the same at every moment on a machine drawing 4K by software. */
export const plumeCount = 120;
export const dustCount = 110;

/** What a sequence draws: three numbers for each particle's place, and four for its colour, with its opacity last. */
export interface ParticlePool {
  positions: Float32Array;
  colors: Float32Array;
}

export interface ParticlePools {
  plume: ParticlePool;
  dust: ParticlePool;
}

function newPool(count: number): ParticlePool {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 4),
  };
}

export function newParticlePools(): ParticlePools {
  return { plume: newPool(plumeCount), dust: newPool(dustCount) };
}

/** Where something is coming down, at ground level. */
export interface Emitter {
  x: number;
  y: number;
  z: number;
}

/** A fixed list of shares from 0 to 1, so that each particle does the same thing every time. */
const shares = Float32Array.from({ length: 1024 }, (_, index) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
});

/** The same share for the same particle and purpose. */
function shareFor(particle: number, purpose: number): number {
  return shares[(particle * 7 + purpose * 131) & 1023] ?? 0;
}

function smooth(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function put(
  { positions, colors }: ParticlePool,
  index: number,
  x: number,
  y: number,
  z: number,
  red: number,
  green: number,
  blue: number,
  opacity: number,
) {
  positions[index * 3] = x;
  positions[index * 3 + 1] = y;
  positions[index * 3 + 2] = z;
  colors[index * 4] = red;
  colors[index * 4 + 1] = green;
  colors[index * 4 + 2] = blue;
  colors[index * 4 + 3] = opacity;
}

function hide({ colors }: ParticlePool, index: number) {
  colors[index * 4 + 3] = 0;
}

/** How far up a model its engine is, where the flame starts. */
const engineHeight = 0.45;

/** Keeps particles from sinking into the ground. */
const justAboveGround = 0.03;

/** Fades everything out before the sequence ends, so that nothing vanishes all at once. */
function fadeToEnd(elapsedMs: number): number {
  return 1 - smooth((elapsedMs - (sequenceMs - 1500)) / 1500);
}

/** The flame under something landing, which goes out on touchdown. */
function writeLandingPlume(
  index: number,
  elapsedMs: number,
  { x, y, z }: Emitter,
  pool: ParticlePool,
) {
  const lifeMs = 260 + shareFor(index, 0) * 320;
  const ageMs = (elapsedMs + shareFor(index, 1) * lifeMs) % lifeMs;
  if (elapsedMs - ageMs >= touchdownMs || elapsedMs < ageMs) {
    hide(pool, index);
    return;
  }
  const share = ageMs / lifeMs;
  const angle = shareFor(index, 2) * Math.PI * 2;
  const spread = shareFor(index, 3) * 0.18 * (0.25 + share);
  const { altitude } = fallAt(false, elapsedMs);
  put(
    pool,
    index,
    x + Math.cos(angle) * spread,
    Math.max(y + altitude + engineHeight - share * 1.8, y + justAboveGround),
    z + Math.sin(angle) * spread,
    1,
    0.95 - share * 0.5,
    0.75 - share * 0.65,
    (1 - share) * 0.9,
  );
}

/** Dust blown out along the ground once the engines get near it. */
function writeLandingDust(
  index: number,
  elapsedMs: number,
  { x, y, z }: Emitter,
  pool: ParticlePool,
) {
  const dustFromMs = touchdownMs * 0.4;
  const bornMs =
    dustFromMs + shareFor(index, 0) * (touchdownMs + 300 - dustFromMs);
  const lifeMs = 1300 + shareFor(index, 1) * 1500;
  const share = (elapsedMs - bornMs) / lifeMs;
  if (share < 0 || share >= 1) {
    hide(pool, index);
    return;
  }
  const angle = shareFor(index, 2) * Math.PI * 2;
  const blown = 1 - (1 - share) * (1 - share);
  const reach = 0.4 + (0.9 + shareFor(index, 3) * 1.9) * blown;
  const shade = 0.85 + shareFor(index, 4) * 0.3;
  put(
    pool,
    index,
    x + Math.cos(angle) * reach,
    y + 0.1 + (0.1 + shareFor(index, 5) * 0.7) * share,
    z + Math.sin(angle) * reach,
    0.74 * shade,
    0.47 * shade,
    0.3 * shade,
    Math.sin(share * Math.PI) * 0.5 * fadeToEnd(elapsedMs),
  );
}

/** A smoke trail left in the sky on the way down, and then a burst of fire on impact. */
function writeCrashPlume(
  index: number,
  elapsedMs: number,
  { x, y, z }: Emitter,
  pool: ParticlePool,
) {
  const angle = shareFor(index, 2) * Math.PI * 2;
  if (elapsedMs < impactMs) {
    const lifeMs = 400 + shareFor(index, 0) * 500;
    const ageMs = (elapsedMs + shareFor(index, 1) * lifeMs) % lifeMs;
    if (elapsedMs < ageMs) {
      hide(pool, index);
      return;
    }
    const share = ageMs / lifeMs;
    const spread = shareFor(index, 3) * 0.3 * share;
    const trailAltitude = fallAt(true, elapsedMs - ageMs).altitude;
    put(
      pool,
      index,
      x + Math.cos(angle) * spread,
      y + Math.max(trailAltitude, justAboveGround),
      z + Math.sin(angle) * spread,
      1 - share * 0.6,
      0.55 - share * 0.35,
      0.15,
      (1 - share) * 0.9,
    );
    return;
  }
  const lifeMs = 500 + shareFor(index, 0) * 1000;
  const share = (elapsedMs - impactMs - shareFor(index, 1) * 200) / lifeMs;
  if (share < 0 || share >= 1) {
    hide(pool, index);
    return;
  }
  const blown = 1 - (1 - share) * (1 - share);
  const outwards = shareFor(index, 3) * 1.8 * blown;
  const up = (0.3 + shareFor(index, 4) * 2.6) * blown - share * share * 0.9;
  put(
    pool,
    index,
    x + Math.cos(angle) * outwards,
    Math.max(y + up, y + justAboveGround),
    z + Math.sin(angle) * outwards,
    1,
    0.85 - share * 0.75,
    0.5 - share * 0.5,
    (1 - share) * 0.95,
  );
}

/** Dust and dark smoke that billow up from where it hit. */
function writeCrashDust(
  index: number,
  elapsedMs: number,
  { x, y, z }: Emitter,
  pool: ParticlePool,
) {
  const bornMs = impactMs + shareFor(index, 0) * 1100;
  const lifeMs = 1400 + shareFor(index, 1) * 2000;
  const share = (elapsedMs - bornMs) / lifeMs;
  if (share < 0 || share >= 1) {
    hide(pool, index);
    return;
  }
  const angle = shareFor(index, 2) * Math.PI * 2;
  const blown = 1 - (1 - share) * (1 - share);
  const reach = 0.25 + (0.7 + shareFor(index, 3) * 2.2) * blown;
  const smoke = shareFor(index, 4);
  put(
    pool,
    index,
    x + Math.cos(angle) * reach,
    y + 0.15 + (0.5 + shareFor(index, 5) * 2.6) * blown,
    z + Math.sin(angle) * reach,
    0.74 - smoke * 0.6,
    0.47 - smoke * 0.38,
    0.3 - smoke * 0.24,
    Math.sin(share * Math.PI) * 0.62 * fadeToEnd(elapsedMs),
  );
}

/**
 * Works out every particle at a moment in a sequence, over the same pools each time, so that nothing
 * is allocated per frame. Particles are shared out between whatever is coming down.
 */
export function writeParticles(
  crashed: boolean,
  elapsedMs: number,
  emitters: readonly Emitter[],
  { plume, dust }: ParticlePools,
) {
  for (let index = 0; index < plumeCount; index++) {
    const emitter = emitters[index % Math.max(emitters.length, 1)];
    if (!emitter) hide(plume, index);
    else if (crashed) writeCrashPlume(index, elapsedMs, emitter, plume);
    else writeLandingPlume(index, elapsedMs, emitter, plume);
  }
  for (let index = 0; index < dustCount; index++) {
    const emitter = emitters[index % Math.max(emitters.length, 1)];
    if (!emitter) hide(dust, index);
    else if (crashed) writeCrashDust(index, elapsedMs, emitter, dust);
    else writeLandingDust(index, elapsedMs, emitter, dust);
  }
}
