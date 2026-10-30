import { describe, expect, it } from "vitest";
import { missionTimeScale } from "./devSettings";

describe("the development time scale", () => {
  it("applies on the development server", () => {
    expect(
      missionTimeScale({ DEV: true, VITE_MISSION_TIME_SCALE: "300" }),
    ).toBe(300);
  });

  it("isn't available in a production build, which is what normal play uses", () => {
    expect(
      missionTimeScale({ DEV: false, VITE_MISSION_TIME_SCALE: "300" }),
    ).toBe(1);
  });

  it("is off unless it's set", () => {
    expect(missionTimeScale({ DEV: true })).toBe(1);
  });

  it("ignores values that aren't positive numbers", () => {
    expect(
      missionTimeScale({ DEV: true, VITE_MISSION_TIME_SCALE: "fast" }),
    ).toBe(1);
    expect(missionTimeScale({ DEV: true, VITE_MISSION_TIME_SCALE: "-5" })).toBe(
      1,
    );
  });
});
