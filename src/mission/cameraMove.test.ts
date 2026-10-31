import { describe, expect, it } from "vitest";
import {
  advanceMove,
  headFor,
  poseDuring,
  settledAt,
  type CameraMove,
} from "./cameraMove";
import type { CameraPose } from "./sceneParts";

const here: CameraPose = { position: [0, 0, 0], target: [0, 0, -1] };
const there: CameraPose = { position: [10, 0, 0], target: [10, 0, -1] };

function advanceBy(move: CameraMove, frames: number, ms: number): CameraMove {
  let moved = move;
  for (let frame = 0; frame < frames; frame++) {
    moved = advanceMove(moved, ms);
  }
  return moved;
}

const across = ({ position }: CameraPose) => position[0];

describe("moving the camera between views", () => {
  it("stays put when settled", () => {
    const move = advanceBy(settledAt(here), 10, 16);
    expect(poseDuring(move)).toEqual(here);
  });

  it("starts from where it is, with no jump", () => {
    const move = headFor(settledAt(here), there);
    expect(poseDuring(move)).toEqual(here);
    expect(across(poseDuring(advanceMove(move, 16)))).toBeLessThan(0.05);
  });

  it("arrives after about a second of real time", () => {
    const move = headFor(settledAt(here), there);
    expect(across(poseDuring(advanceBy(move, 30, 16)))).toBeLessThan(10);
    expect(poseDuring(advanceBy(move, 70, 16))).toEqual(there);
  });

  it("moves its target along with its position", () => {
    const halfway = poseDuring(
      advanceBy(headFor(settledAt(here), there), 25, 20),
    );
    expect(halfway.position[0]).toBeCloseTo(5);
    expect(halfway.target[0]).toBeCloseTo(5);
  });

  it("speeds up and slows down, never going back", () => {
    let move = headFor(settledAt(here), there);
    const places = [across(poseDuring(move))];
    for (let frame = 0; frame < 10; frame++) {
      move = advanceMove(move, 100);
      places.push(across(poseDuring(move)));
    }
    const steps = places.slice(1).map((place, index) => {
      return place - (places[index] ?? 0);
    });
    expect(steps.every((step) => step >= 0)).toBe(true);
    expect(steps[0]).toBeLessThan(steps[4] ?? 0);
    expect(steps[9]).toBeLessThan(steps[4] ?? 0);
  });

  it("starts an interrupted move from wherever the camera has got to", () => {
    const partWay = advanceBy(headFor(settledAt(here), there), 25, 20);
    const place = poseDuring(partWay);
    const turnedBack = headFor(partWay, here);
    expect(poseDuring(turnedBack)).toEqual(place);
    expect(poseDuring(advanceBy(turnedBack, 60, 20))).toEqual(here);
  });

  it("doesn't skip ahead on a long frame", () => {
    const move = advanceMove(headFor(settledAt(here), there), 5000);
    expect(across(poseDuring(move))).toBeLessThan(1);
  });
});
