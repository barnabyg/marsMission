import { describe, expect, it, vi } from "vitest";
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
});
