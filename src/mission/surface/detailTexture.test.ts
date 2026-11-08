import { describe, expect, it, vi } from "vitest";
import { detailTexels, detailTextureSize } from "./detailTexture";

const size = detailTextureSize;
const at = (texels: Uint8Array, column: number, row: number) =>
  texels[row * size + column] ?? 0;

describe("the fine grain drawn over the ground", () => {
  it("is the same every time, from no outside randomness", () => {
    const random = vi.spyOn(Math, "random");
    expect(detailTexels()).toEqual(detailTexels());
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("has one value for each texel of a square", () => {
    expect(detailTexels().length).toBe(size * size);
  });

  it("leaves the ground's colour as it is on average, lightening and darkening it about evenly", () => {
    const texels = detailTexels();
    const mean = texels.reduce((sum, value) => sum + value, 0) / texels.length;
    expect(mean).toBeGreaterThan(118);
    expect(mean).toBeLessThan(138);
    expect(Math.max(...texels) - Math.min(...texels)).toBeGreaterThan(80);
  });

  it("tiles without a seam, its edges meeting as smoothly as its neighbouring texels do", () => {
    const texels = detailTexels();
    let across = 0;
    let within = 0;
    for (let line = 0; line < size; line++) {
      across += Math.abs(at(texels, 0, line) - at(texels, size - 1, line));
      across += Math.abs(at(texels, line, 0) - at(texels, line, size - 1));
      within += Math.abs(at(texels, 1, line) - at(texels, 0, line));
      within += Math.abs(at(texels, line, 1) - at(texels, line, 0));
    }
    expect(across).toBeLessThan(within * 1.5);
  });
});
