import { describe, expect, it, vi } from "vitest";
import {
  dustCount,
  newParticlePools,
  plumeCount,
  writeParticles,
  type ParticlePool,
} from "./particles";
import { fallAt, impactMs, sequenceMs, touchdownMs } from "./sequence";

const one = [{ x: 1.5, y: 0.2, z: 0 }];
const two = [
  { x: -1.5, y: 0.1, z: 0 },
  { x: 1.5, y: 0.2, z: 0 },
];

function particlesAt(
  crashed: boolean,
  elapsedMs: number,
  emitters = one,
): { plume: ParticlePool; dust: ParticlePool } {
  const pools = newParticlePools();
  writeParticles(crashed, elapsedMs, emitters, pools);
  return pools;
}

function shown({ positions, colors }: ParticlePool) {
  const points: { x: number; y: number; z: number; alpha: number }[] = [];
  for (let index = 0; index < colors.length / 4; index++) {
    const alpha = colors[index * 4 + 3] ?? 0;
    if (alpha > 0) {
      points.push({
        x: positions[index * 3] ?? 0,
        y: positions[index * 3 + 1] ?? 0,
        z: positions[index * 3 + 2] ?? 0,
        alpha,
      });
    }
  }
  return points;
}

describe("plumes and dust", () => {
  it("come from fixed pools", () => {
    const { plume, dust } = newParticlePools();
    expect(plume.positions).toHaveLength(plumeCount * 3);
    expect(plume.colors).toHaveLength(plumeCount * 4);
    expect(dust.positions).toHaveLength(dustCount * 3);
    expect(dust.colors).toHaveLength(dustCount * 4);
  });

  it("depend only on what they're given, and write over the same pools", () => {
    const random = vi.spyOn(Math, "random");
    const first = particlesAt(false, 2500);
    const pools = particlesAt(true, 1000);
    writeParticles(false, 2500, one, pools);
    expect(pools.plume.positions).toEqual(first.plume.positions);
    expect(pools.dust.colors).toEqual(first.dust.colors);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("differ between a landing and a crash", () => {
    expect(particlesAt(true, impactMs + 500).plume.colors).not.toEqual(
      particlesAt(false, impactMs + 500).plume.colors,
    );
  });

  it.each([false, true])(
    "leave nothing showing at the end (crash: %s)",
    (crashed) => {
      const { plume, dust } = particlesAt(crashed, sequenceMs);
      expect(shown(plume)).toEqual([]);
      expect(shown(dust)).toEqual([]);
    },
  );

  it.each([false, true])("stay above the ground (crash: %s)", (crashed) => {
    for (let elapsedMs = 0; elapsedMs < sequenceMs; elapsedMs += 137) {
      const { plume, dust } = particlesAt(crashed, elapsedMs);
      for (const { y } of [...shown(plume), ...shown(dust)]) {
        expect(y).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it("stay with what's coming down, and under it, during a landing", () => {
    const elapsedMs = 1500;
    const { altitude } = fallAt(false, elapsedMs);
    const flames = shown(particlesAt(false, elapsedMs).plume);
    expect(flames.length).toBeGreaterThan(plumeCount / 2);
    for (const { x, y } of flames) {
      expect(y).toBeLessThanOrEqual(0.2 + altitude + 0.5);
      expect(y).toBeGreaterThan(0.2 + altitude - 2);
      expect(Math.abs(x - 1.5)).toBeLessThan(0.5);
    }
  });

  it("raise no dust until a landing is near the ground, and cut the engines on touchdown", () => {
    expect(shown(particlesAt(false, 500).dust)).toEqual([]);
    expect(shown(particlesAt(false, touchdownMs).dust).length).toBeGreaterThan(
      dustCount / 3,
    );
    expect(shown(particlesAt(false, touchdownMs + 1000).plume)).toEqual([]);
  });

  it("burst and billow at a crash, with nothing of the kind before it", () => {
    expect(shown(particlesAt(true, impactMs - 1).dust)).toEqual([]);
    const burst = shown(particlesAt(true, impactMs + 300).plume);
    expect(burst.length).toBeGreaterThan(plumeCount / 2);
    const billow = shown(particlesAt(true, impactMs + 1500).dust);
    expect(billow.length).toBeGreaterThan(dustCount / 2);
    expect(Math.max(...billow.map(({ y }) => y))).toBeGreaterThan(1);
  });

  it("shares the pools between everything coming down", () => {
    const flames = shown(particlesAt(false, 1500, two).plume);
    expect(flames.some(({ x }) => x < 0)).toBe(true);
    expect(flames.some(({ x }) => x > 0)).toBe(true);
  });

  it("copes with nothing coming down", () => {
    const { plume, dust } = particlesAt(false, 1500, []);
    expect(shown(plume)).toEqual([]);
    expect(shown(dust)).toEqual([]);
  });
});
