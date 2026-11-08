import { describe, expect, it, vi } from "vitest";
import { rocksAt } from "./rocks";
import { placeOf } from "./surface";
import { groundHeight, terrainReach } from "./terrain";

describe("a Landing Site's rocks", () => {
  it("are the same every time for the same site", () => {
    expect(rocksAt("Jezero Crater")).toEqual(rocksAt("Jezero Crater"));
  });

  it("lie differently from one site to another", () => {
    expect(rocksAt("Gale Crater")).not.toEqual(rocksAt("Jezero Crater"));
  });

  it("use no outside randomness", () => {
    const random = vi.spyOn(Math, "random");
    rocksAt("Utopia Planitia");
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("are many small stones and a few boulders", () => {
    const rocks = rocksAt("Jezero Crater");
    expect(rocks.length).toBeGreaterThan(150);
    expect(rocks.length).toBeLessThan(400);
    const boulders = rocks.filter(({ size }) => Math.max(...size) > 0.25);
    expect(boulders.length).toBeGreaterThan(2);
    expect(boulders.length).toBeLessThan(rocks.length / 5);
  });

  it("sit on the ground, partly buried, within the terrain", () => {
    for (const { x, y, z, size } of rocksAt("Gale Crater")) {
      expect(Math.abs(x)).toBeLessThan(terrainReach);
      expect(Math.abs(z)).toBeLessThan(terrainReach);
      const ground = groundHeight("Gale Crater", x, z);
      expect(y).toBeLessThanOrEqual(ground);
      expect(y).toBeGreaterThan(ground - size[1]);
    }
  });

  it("keep clear of the places where Assets stand, and of the Crew's landers behind them", () => {
    const spots = Array.from({ length: 8 }, (_, place) => placeOf(place));
    const behind = spots.flatMap(({ x, z }) => [
      { x, z: z + 1.4 },
      { x, z: z + 2.8 },
    ]);
    for (const { x, z, size } of rocksAt("Jezero Crater")) {
      for (const spot of [...spots, ...behind]) {
        expect(Math.hypot(x - spot.x, z - spot.z)).toBeGreaterThan(
          1.1 + Math.max(...size),
        );
      }
    }
  });

  it("each face a way and are shaded a little differently, so they don't look stamped out", () => {
    const rocks = rocksAt("Jezero Crater");
    expect(
      new Set(rocks.map(({ turn }) => turn.toFixed(2))).size,
    ).toBeGreaterThan(rocks.length / 2);
    const shades = rocks.map(({ shade }) => shade);
    expect(Math.max(...shades) - Math.min(...shades)).toBeGreaterThan(0.2);
  });
});
