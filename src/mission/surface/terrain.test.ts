import { describe, expect, it, vi } from "vitest";
import { standingSpots } from "./surface";
import { buildTerrain, groundHeight, terrainReach } from "./terrain";

describe("a Landing Site's terrain", () => {
  it("is the same every time for the same site", () => {
    const first = buildTerrain("Jezero Crater");
    const second = buildTerrain("Jezero Crater");
    expect(second.positions).toEqual(first.positions);
    expect(second.colors).toEqual(first.colors);
    expect(second.indices).toEqual(first.indices);
  });

  it("differs from one site to another", () => {
    expect(buildTerrain("Gale Crater").positions).not.toEqual(
      buildTerrain("Jezero Crater").positions,
    );
  });

  it("uses no outside randomness", () => {
    const random = vi.spyOn(Math, "random");
    buildTerrain("Gale Crater");
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("stays under 10,000 vertices, which software rendering at 4K can draw", () => {
    const { positions } = buildTerrain("Jezero Crater");
    expect(positions.length / 3).toBeLessThan(10_000);
  });

  it("has a colour for each vertex, and triangles that only use real vertices", () => {
    const { positions, colors, indices } = buildTerrain("Jezero Crater");
    expect(colors.length).toBe(positions.length);
    expect(Math.max(...indices)).toBe(positions.length / 3 - 1);
    expect(indices.length % 3).toBe(0);
  });

  it("is not flat, and is gentle where the Assets stand", () => {
    const heights = Array.from({ length: 200 }, (_, index) =>
      groundHeight("Jezero Crater", index / 10 - 10, 7),
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.2);
    const middle = Array.from({ length: 40 }, (_, index) =>
      groundHeight("Jezero Crater", index / 10 - 2, 0),
    );
    expect(Math.max(...middle) - Math.min(...middle)).toBeLessThan(0.25);
  });

  it("puts its vertices on the ground that Assets are placed on", () => {
    const { positions } = buildTerrain("Gale Crater");
    const [x, y, z] = [positions[0], positions[1], positions[2]];
    expect(y).toBeCloseTo(groundHeight("Gale Crater", x ?? 0, z ?? 0), 5);
  });

  it("is lit, with sides towards the Sun brighter than sides away from it", () => {
    const { colors } = buildTerrain("Jezero Crater");
    const reds = colors.filter((_, index) => index % 3 === 0);
    expect(Math.max(...reds)).toBeGreaterThan(Math.min(...reds) * 1.3);
  });

  it("fades into the same colour along its whole edge, so that it has no hard line against the sky", () => {
    const first = buildTerrain("Jezero Crater");
    const second = buildTerrain("Gale Crater");
    expect([...first.colors.slice(0, 3)]).toEqual([
      ...second.colors.slice(0, 3),
    ]);
  });

  it("reaches well beyond the Assets", () => {
    const { positions } = buildTerrain("Jezero Crater");
    const xs = positions.filter((_, index) => index % 3 === 0);
    expect(Math.max(...xs)).toBeCloseTo(terrainReach, 3);
    expect(Math.min(...xs)).toBeCloseTo(-terrainReach, 3);
  });

  it("has small-scale relief, such as small craters and wind ridges, over much of the ground beyond the middle", () => {
    for (const site of ["Jezero Crater", "Gale Crater", "Utopia Planitia"]) {
      let bumpy = 0;
      let checked = 0;
      for (let z = 2; z < 11; z += 0.5) {
        for (let x = -10; x < 10; x += 0.5) {
          const height = (step: number) =>
            groundHeight(site, x + step * 0.1, z);
          const bend = Math.abs(height(0) - 2 * height(1) + height(2));
          checked += 1;
          if (bend > 0.004) bumpy += 1;
        }
      }
      expect(bumpy / checked).toBeGreaterThan(0.4);
    }
  });

  it("is coloured between grey basalt and red dust, not only lit lighter and darker", () => {
    const { colors, detail } = buildTerrain("Jezero Crater");
    const redness: number[] = [];
    detail.forEach((share, vertex) => {
      if (share < 1) return;
      redness.push((colors[vertex * 3] ?? 0) / (colors[vertex * 3 + 1] ?? 1));
    });
    expect(Math.max(...redness) - Math.min(...redness)).toBeGreaterThan(0.4);
  });

  it("has fine grain drawn on it near the camera, which fades out before the far edge", () => {
    const { positions, detail } = buildTerrain("Gale Crater");
    expect(detail.length).toBe(positions.length / 3);
    const middle = detail.findIndex(
      (_, vertex) =>
        Math.hypot(positions[vertex * 3] ?? 0, positions[vertex * 3 + 2] ?? 0) <
        0.5,
    );
    expect(detail[middle]).toBe(1);
    expect(detail[0]).toBe(0);
    expect(detail.at(-1)).toBe(0);
  });

  it("is level where Assets stand, so that their feet reach the ground", () => {
    for (const site of [
      "Jezero Crater",
      "Gale Crater",
      "Utopia Planitia",
      "Elysium Planitia",
    ]) {
      for (const { x, z } of standingSpots) {
        const heights = Array.from({ length: 16 }, (_, step) => {
          const angle = (step / 16) * Math.PI * 2;
          return groundHeight(
            site,
            x + Math.cos(angle) * 0.6,
            z + Math.sin(angle) * 0.6,
          );
        });
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.02);
      }
    }
  });
});
