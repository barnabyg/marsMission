import { describe, expect, it } from "vitest";
import type { AssetAtMars } from "../../simulation/simulation";
import { orbiterPosition, orbitersOn, orbitRadius } from "./marsOrbit";

const asset = (overrides: Partial<AssetAtMars>): AssetAtMars => ({
  name: "Orbiter",
  kind: "orbiter",
  landingSiteName: null,
  fromDay: 0,
  ...overrides,
});

describe("the orbiters in the Mars orbit view", () => {
  it("leaves out anything on the surface", () => {
    const assetsAtMars = [
      asset({ name: "Lander", landingSiteName: "Alpha Plain" }),
      asset({ name: "Orbiter" }),
    ];
    expect(orbitersOn({ assetsAtMars }, 10).map(({ name }) => name)).toEqual([
      "Orbiter",
    ]);
  });

  it("includes one that arrives during the Turn, from the day it arrives", () => {
    const assetsAtMars = [asset({ name: "Newcomer", fromDay: 200 })];
    expect(orbitersOn({ assetsAtMars }, 199.9)).toEqual([]);
    expect(orbitersOn({ assetsAtMars }, 200).map(({ name }) => name)).toEqual([
      "Newcomer",
    ]);
  });

  it("keeps an orbiter's slot when another arrives, so that it doesn't jump", () => {
    const assetsAtMars = [
      asset({ name: "First" }),
      asset({ name: "Second", fromDay: 200 }),
    ];
    const slotOfFirst = (day: number) =>
      orbitersOn({ assetsAtMars }, day).find(({ name }) => name === "First")
        ?.slot;
    expect(slotOfFirst(199)).toBe(slotOfFirst(200));
  });

  it("goes round Mars at a fixed distance, keeping orbiters apart", () => {
    const [x, y, z] = orbiterPosition(0, 50);
    expect(y).toBe(0);
    expect(Math.hypot(x, z)).toBeCloseTo(orbitRadius);
    expect(orbiterPosition(0, 51)).not.toEqual(orbiterPosition(0, 50));
    expect(orbiterPosition(1, 50)).not.toEqual(orbiterPosition(0, 50));
  });
});
