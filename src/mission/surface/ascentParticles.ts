import { smooth } from "./shaping";
import {
  dustCount,
  hide,
  plumeCount,
  put,
  shareFor,
  writeImpactFire,
  writeImpactSmoke,
  type Emitter,
  type ParticlePools,
  type ParticlePool,
} from "./particles";
import { ascentImpactMs, ascentMs, ignitionMs, riseAt } from "./ascent";

/** What lifts off from an emitter: how far up its engine is from the ground it stands on. */
export interface AscentEmitter extends Emitter {
  engineHeight: number;
}

/** Fades everything out before the ascent ends, so that nothing vanishes all at once. */
function fadeToEnd(elapsedMs: number): number {
  return 1 - smooth((elapsedMs - (ascentMs - 1500)) / 1500);
}

/** The flame under what's lifting off, left behind in the air as it climbs, for as long as its engine burns. */
function writeAscentPlume(
  index: number,
  failed: boolean,
  elapsedMs: number,
  { x, y, z, engineHeight }: AscentEmitter,
  pool: ParticlePool,
) {
  const lifeMs = 300 + shareFor(index, 0) * 400;
  const ageMs = (elapsedMs + shareFor(index, 1) * lifeMs) % lifeMs;
  const bornMs = elapsedMs - ageMs;
  const then = riseAt(failed, bornMs);
  if (bornMs < ignitionMs || !then.burning) {
    hide(pool, index);
    return;
  }
  const share = ageMs / lifeMs;
  const angle = shareFor(index, 2) * Math.PI * 2;
  const spread = shareFor(index, 3) * 0.2 * (0.3 + share);
  // Pouring down from the engine, and spreading out over the ground before it lifts clear.
  const drop = share * 1.4;
  const height = Math.max(y + then.altitude + engineHeight - drop, y + 0.05);
  const splash = height <= y + 0.05 ? share * 0.9 : 0;
  put(
    pool,
    index,
    x + Math.cos(angle) * (spread + splash),
    height,
    z + Math.sin(angle) * (spread + splash),
    1,
    0.95 - share * 0.5,
    0.75 - share * 0.65,
    (1 - share) * 0.9,
  );
}

/** Dust blown out along the ground by the engine as it lifts off. */
function writeAscentDust(
  index: number,
  elapsedMs: number,
  { x, y, z }: Emitter,
  pool: ParticlePool,
) {
  const bornMs = ignitionMs + shareFor(index, 0) * 1700;
  const lifeMs = 1300 + shareFor(index, 1) * 1600;
  const share = (elapsedMs - bornMs) / lifeMs;
  if (share < 0 || share >= 1) {
    hide(pool, index);
    return;
  }
  const angle = shareFor(index, 2) * Math.PI * 2;
  const blown = 1 - (1 - share) * (1 - share);
  const reach = 0.5 + (1 + shareFor(index, 3) * 2) * blown;
  const shade = 0.85 + shareFor(index, 4) * 0.3;
  put(
    pool,
    index,
    x + Math.cos(angle) * reach,
    y + 0.1 + (0.15 + shareFor(index, 5) * 0.8) * share,
    z + Math.sin(angle) * reach,
    0.74 * shade,
    0.47 * shade,
    0.3 * shade,
    Math.sin(share * Math.PI) * 0.5 * fadeToEnd(elapsedMs),
  );
}

/**
 * Works out every particle at a moment in Mars ascent, over the same pools each time, so that nothing is allocated per
 * frame: the plume and the dust it raises, and for a failed ascent, the fire and smoke where it falls back. Particles
 * are shared out between whatever is lifting off.
 */
export function writeAscentParticles(
  failed: boolean,
  elapsedMs: number,
  emitters: readonly AscentEmitter[],
  { plume, dust }: ParticlePools,
) {
  const { drift } = riseAt(failed, ascentImpactMs);
  const sinceImpactMs = elapsedMs - ascentImpactMs;
  for (let index = 0; index < plumeCount; index++) {
    const emitter = emitters[index % Math.max(emitters.length, 1)];
    if (!emitter) hide(plume, index);
    else if (failed && sinceImpactMs >= 0) {
      writeImpactFire(
        index,
        sinceImpactMs,
        { ...emitter, x: emitter.x + drift },
        plume,
      );
    } else writeAscentPlume(index, failed, elapsedMs, emitter, plume);
  }
  for (let index = 0; index < dustCount; index++) {
    const emitter = emitters[index % Math.max(emitters.length, 1)];
    if (!emitter) hide(dust, index);
    else if (failed && sinceImpactMs >= 0 && index % 2 === 0) {
      writeImpactSmoke(
        index,
        sinceImpactMs,
        { ...emitter, x: emitter.x + drift },
        dust,
        fadeToEnd(elapsedMs),
      );
    } else writeAscentDust(index, elapsedMs, emitter, dust);
  }
}
