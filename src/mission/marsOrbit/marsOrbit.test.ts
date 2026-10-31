import { describe, expect, it } from "vitest";
import type { AssetAtMars, Timeline } from "../../simulation/simulation";
import {
  globeSpin,
  landedOn,
  landingMarkersOn,
  orbiterPosition,
  orbitersOn,
  orbitRadius,
  surfacePoint,
} from "./marsOrbit";

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];

const asset = (overrides: Partial<AssetAtMars>): AssetAtMars => ({
  name: "Orbiter",
  kind: "orbiter",
  landingSiteName: null,
  activityName: "Survey",
  surfaceMotion: "still",
  arrivedOnDay: -100,
  fromDay: 0,
  untilDay: null,
  ...overrides,
});

const lander = (overrides: Partial<MissionAsset>): MissionAsset => ({
  name: "Lander",
  landingSiteName: "Jezero Crater",
  deliveredOnDay: 205,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

const mission = (
  assets: MissionAsset[],
): Pick<Mission, "arrivalDay" | "assets"> => ({ arrivalDay: 200, assets });

describe("the orbiters in the Mars orbit view", () => {
  it("leaves out one from the day it stops operating", () => {
    const timeline = { assetsAtMars: [asset({ untilDay: 300 })] };
    expect(orbitersOn(timeline, 299).map(({ name }) => name)).toEqual([
      "Orbiter",
    ]);
    expect(orbitersOn(timeline, 300)).toEqual([]);
  });

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

describe("a landing in the Mars orbit view", () => {
  it("shows nothing before the Mission arrives", () => {
    expect(landingMarkersOn(mission([lander({})]), 199)).toEqual([]);
  });

  it("comes down from orbit to the surface around the day of the landing", () => {
    const flying = mission([lander({})]);
    const altitudes = [200, 202, 205, 210].map(
      (day) => landingMarkersOn(flying, day)[0]?.altitude,
    );
    expect(altitudes[0]).toBe(1);
    expect(altitudes[1]).toBeLessThan(1);
    expect(altitudes[2]).toBeLessThan(altitudes[1] ?? 0);
    expect(altitudes[3]).toBeLessThan(altitudes[2] ?? 0);
    expect(altitudes[3]).toBeGreaterThan(0);
  });

  it("hands over to the marker on the surface once it has come down", () => {
    const flying = mission([lander({})]);
    const assetsAtMars = [
      asset({
        name: "Lander",
        landingSiteName: "Jezero Crater",
        fromDay: 205,
      }),
    ];
    expect(landingMarkersOn(flying, 214.9)).toHaveLength(1);
    expect(landedOn({ assetsAtMars }, 214.9)).toEqual([]);
    expect(landingMarkersOn(flying, 215)).toEqual([]);
    expect(landedOn({ assetsAtMars }, 215)).toEqual([
      { name: "Lander", siteName: "Jezero Crater" },
    ]);
  });

  it("shows a lander already on the surface from the first day of the Turn", () => {
    const assetsAtMars = [
      asset({ name: "Old Lander", landingSiteName: "Gale Crater" }),
    ];
    expect(landedOn({ assetsAtMars }, 0)).toEqual([
      { name: "Old Lander", siteName: "Gale Crater" },
    ]);
  });

  it("leaves orbiters off the surface", () => {
    expect(landedOn({ assetsAtMars: [asset({})] }, 0)).toEqual([]);
  });

  it("only turns red once it has crashed, then stays on the surface", () => {
    const crashing = mission([
      lander({ deliveredOnDay: null, lostOnDay: 205, crashed: true }),
    ]);
    expect(landingMarkersOn(crashing, 204)[0]?.crashed).toBe(false);
    expect(landingMarkersOn(crashing, 205)[0]?.crashed).toBe(true);
    expect(landingMarkersOn(crashing, 700)[0]).toMatchObject({
      crashed: true,
      altitude: 0,
    });
  });

  it("shows nothing of a lander lost on the way to Mars", () => {
    const lost = mission([
      lander({ deliveredOnDay: null, lostOnDay: 1, crashed: false }),
    ]);
    expect(landingMarkersOn(lost, 300)).toEqual([]);
    expect(landingMarkersOn(null, 300)).toEqual([]);
  });

  it("leaves out orbiters on the same Mission", () => {
    const both = mission([
      lander({ name: "Orbiter", landingSiteName: null, deliveredOnDay: 200 }),
    ]);
    expect(landingMarkersOn(both, 200)).toEqual([]);
  });
});

describe("where things are on the globe", () => {
  const sites = [
    { name: "Jezero Crater", latitude: 18.4, longitude: 77.5 },
    { name: "Gale Crater", latitude: -5.4, longitude: 137.8 },
  ];

  it("fails loudly on a Landing Site the Timeline doesn't list", () => {
    expect(() => surfacePoint(sites, "Nowhere", 0, 0)).toThrow(/Nowhere/);
  });

  it("turns the Landing Site towards the camera on the day of the landing", () => {
    const flying = mission([lander({})]);
    const [x, , z] = surfacePoint(
      sites,
      "Jezero Crater",
      globeSpin(sites, flying, 205),
      0,
    );
    expect(x).toBeCloseTo(0);
    expect(z).toBeGreaterThan(0.5);
  });

  it("turns a crash site towards the camera too", () => {
    const crashing = mission([
      lander({ deliveredOnDay: null, lostOnDay: 205, crashed: true }),
    ]);
    const [x] = surfacePoint(
      sites,
      "Jezero Crater",
      globeSpin(sites, crashing, 205),
      0,
    );
    expect(x).toBeCloseTo(0);
  });

  it("keeps turning slowly, with or without a landing", () => {
    expect(globeSpin(sites, null, 11)).toBeGreaterThan(
      globeSpin(sites, null, 10),
    );
    const flying = mission([lander({})]);
    expect(globeSpin(sites, flying, 206)).toBeGreaterThan(
      globeSpin(sites, flying, 205),
    );
  });

  it("puts a point on the surface, spacing out landers at the same Landing Site", () => {
    const [x, y, z] = surfacePoint(sites, "Gale Crater", 1, 0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    expect(surfacePoint(sites, "Gale Crater", 1, 1)).not.toEqual([x, y, z]);
  });
});
