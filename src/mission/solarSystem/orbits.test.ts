import { describe, expect, it } from "vitest";
import {
  angleBetweenDegrees,
  journeyHasFailed,
  journeyProgress,
  planetPosition,
  spacecraftPosition,
} from "./orbits";

const startDate = "2028-12-01";
const mission = { launchDay: 0, arrivalDay: 210, failedOnDay: null };

function separationDegrees(date: string): number {
  return angleBetweenDegrees(
    planetPosition("earth", date),
    planetPosition("mars", date),
  );
}

describe("Earth and Mars", () => {
  it("line up on the same side of the Sun at a real opposition", () => {
    expect(separationDegrees("2025-01-16")).toBeLessThan(20);
    expect(separationDegrees("2027-02-19")).toBeLessThan(20);
  });

  it("sit on opposite sides of the Sun at a real conjunction", () => {
    expect(separationDegrees("2023-11-18")).toBeGreaterThan(160);
  });

  it("stay at their own distances from the Sun", () => {
    const { x, z } = planetPosition("mars", startDate);
    expect(Math.hypot(x, z)).toBeCloseTo(1.524);
  });

  it("move as game time passes", () => {
    const before = planetPosition("earth", "2029-01-01");
    const after = planetPosition("earth", "2029-04-02");
    expect(angleBetweenDegrees(before, after)).toBeGreaterThan(80);
    expect(angleBetweenDegrees(before, after)).toBeLessThan(100);
  });
});

describe("the spacecraft", () => {
  it("starts at Earth on the launch day", () => {
    const position = spacecraftPosition(startDate, mission, 0);
    const earth = planetPosition("earth", startDate);
    expect(position.x).toBeCloseTo(earth.x);
    expect(position.z).toBeCloseTo(earth.z);
  });

  it("reaches Mars on the arrival day", () => {
    const position = spacecraftPosition(startDate, mission, 210);
    const mars = planetPosition("mars", "2029-06-29");
    expect(position.x).toBeCloseTo(mars.x);
    expect(position.z).toBeCloseTo(mars.z);
  });

  it("is between the two orbits halfway through the journey", () => {
    const { x, z } = spacecraftPosition(startDate, mission, 105);
    const radius = Math.hypot(x, z);
    expect(radius).toBeGreaterThan(1);
    expect(radius).toBeLessThan(1.524);
  });

  it("tracks the Turn's progress, whatever the speed that got it there", () => {
    expect(journeyProgress(mission, 0)).toBe(0);
    expect(journeyProgress(mission, 105)).toBe(0.5);
    expect(journeyProgress(mission, 210)).toBe(1);
    expect(journeyProgress(mission, 500)).toBe(1);
  });

  it("stops where a Mission Event failed", () => {
    const failed = { ...mission, failedOnDay: 105 };
    expect(journeyProgress(failed, 50)).toBeCloseTo(50 / 210);
    expect(journeyProgress(failed, 105)).toBe(0.5);
    expect(journeyProgress(failed, 700)).toBe(0.5);
  });

  it("only counts as failed from the day of the failure", () => {
    const failed = { ...mission, failedOnDay: 105 };
    expect(journeyHasFailed(failed, 104)).toBe(false);
    expect(journeyHasFailed(failed, 105)).toBe(true);
    expect(journeyHasFailed(mission, 700)).toBe(false);
  });
});
