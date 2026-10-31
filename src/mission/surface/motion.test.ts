import { describe, expect, it, vi } from "vitest";
import { roverSpot, type RoverAtWork } from "./motion";
import { placeOf } from "./surface";
import { terrainReach } from "./terrain";

const anchor = { x: 1.5, z: 0 };

const rover = (overrides: Partial<RoverAtWork> = {}): RoverAtWork => ({
  surfaceMotion: "traverse",
  key: "rover:2030-01-01",
  arrivedOnDay: 200,
  fromDay: 200,
  untilDay: null,
  ...overrides,
});

const distance = (
  first: { x: number; z: number },
  second: { x: number; z: number },
) => Math.hypot(first.x - second.x, first.z - second.z);

/** How far it gets from its spot, and how far it travels, sampling each day of a Turn. */
function journeyOver(asset: RoverAtWork, fromDay: number, toDay: number) {
  let furthest = 0;
  let travelled = 0;
  let last = roverSpot(asset, anchor, fromDay);
  for (let day = fromDay; day <= toDay; day++) {
    const spot = roverSpot(asset, anchor, day);
    furthest = Math.max(furthest, distance(spot, anchor));
    travelled += distance(spot, last);
    last = spot;
  }
  return { furthest, travelled };
}

describe("a rover's movement", () => {
  it("starts at its landing spot", () => {
    for (const surfaceMotion of ["traverse", "nearby", "still"] as const) {
      expect(
        distance(roverSpot(rover({ surfaceMotion }), anchor, 200), anchor),
      ).toBeLessThan(0.001);
    }
  });

  it("covers a long way on a Long traverse, going far from its spot", () => {
    const { furthest, travelled } = journeyOver(rover(), 200, 780);
    expect(furthest).toBeGreaterThan(2);
    expect(travelled).toBeGreaterThan(15);
  });

  it("stays near its spot during Soil analysis, but still moves", () => {
    const { furthest, travelled } = journeyOver(
      rover({ surfaceMotion: "nearby" }),
      200,
      780,
    );
    expect(furthest).toBeLessThan(0.7);
    expect(travelled).toBeGreaterThan(1);
  });

  it("stays still on Nothing", () => {
    const { furthest, travelled } = journeyOver(
      rover({ surfaceMotion: "still" }),
      200,
      780,
    );
    expect(furthest).toBe(0);
    expect(travelled).toBe(0);
  });

  it("waits a while before driving off, so that a landing can finish at any speed", () => {
    expect(distance(roverSpot(rover(), anchor, 225), anchor)).toBeLessThan(
      0.001,
    );
    expect(distance(roverSpot(rover(), anchor, 260), anchor)).toBeGreaterThan(
      0.5,
    );
  });

  it("stops on the day it stops operating", () => {
    const stopping = rover({ untilDay: 500 });
    const atTheEnd = roverSpot(stopping, anchor, 500);
    expect(atTheEnd).not.toEqual(roverSpot(stopping, anchor, 400));
    expect(roverSpot(stopping, anchor, 600)).toEqual(atTheEnd);
    expect(roverSpot(stopping, anchor, 780)).toEqual(atTheEnd);
  });

  it("doesn't move before it starts operating", () => {
    expect(roverSpot(rover(), anchor, 100)).toEqual(
      roverSpot(rover(), anchor, 200),
    );
  });

  it("carries on next Turn from where it had got to", () => {
    const lastTurn = roverSpot(rover(), anchor, 780);
    const nextTurn = roverSpot(
      rover({ arrivedOnDay: 200 - 780, fromDay: 0 }),
      anchor,
      0,
    );
    expect(nextTurn.x).toBeCloseTo(lastTurn.x, 6);
    expect(nextTurn.z).toBeCloseTo(lastTurn.z, 6);
  });

  it("moves in small steps at the rate of the days, so that it never jumps", () => {
    let last = roverSpot(rover(), anchor, 200);
    for (let day = 200; day < 2000; day += 0.5) {
      const spot = roverSpot(rover(), anchor, day);
      expect(distance(spot, last)).toBeLessThan(0.05);
      last = spot;
    }
  });

  it("goes its own way for each Asset, the same way every time", () => {
    const other = rover({ key: "rover:2032-03-04" });
    expect(roverSpot(other, anchor, 500)).not.toEqual(
      roverSpot(rover(), anchor, 500),
    );
    expect(roverSpot(rover(), anchor, 500)).toEqual(
      roverSpot(rover(), anchor, 500),
    );
  });

  it("uses no outside randomness or clock", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    roverSpot(rover(), anchor, 500);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  it("stays on the terrain for years, from every place, whichever way it goes", () => {
    for (let place = 0; place < 13; place++) {
      for (const key of ["a:1", "b:2", "c:3", "d:4", "e:5", "f:6"]) {
        const start = placeOf(place);
        for (let day = 0; day < 6000; day += 7) {
          const { x, z } = roverSpot(
            rover({ arrivedOnDay: 0, fromDay: 0, key }),
            start,
            day,
          );
          expect(Math.abs(x)).toBeLessThan(terrainReach);
          expect(Math.abs(z)).toBeLessThan(terrainReach);
        }
      }
    }
  });

  it("drives clear of the Asset beside it at the first two places", () => {
    for (const key of ["a:1", "b:2", "c:3", "d:4"]) {
      for (const place of [0, 1]) {
        const start = placeOf(place);
        const neighbour = placeOf(1 - place);
        for (let day = 0; day < 2000; day += 5) {
          const spot = roverSpot(
            rover({ arrivedOnDay: 0, fromDay: 0, key }),
            start,
            day,
          );
          expect(distance(spot, neighbour)).toBeGreaterThan(1.5);
        }
      }
    }
  });

  it("faces the way it is going", () => {
    const [before, after] = [
      roverSpot(rover(), anchor, 400),
      roverSpot(rover(), anchor, 400.5),
    ];
    const along = { x: after.x - before.x, z: after.z - before.z };
    const facing = {
      x: Math.cos(before.heading),
      z: -Math.sin(before.heading),
    };
    const cosine =
      (along.x * facing.x + along.z * facing.z) / Math.hypot(along.x, along.z);
    expect(cosine).toBeGreaterThan(0.99);
  });
});
