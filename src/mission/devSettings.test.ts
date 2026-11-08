import { describe, expect, it } from "vitest";
import { missionTimeScale, sequenceTimeScale } from "./devSettings";

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

describe("the development time scale for what plays in real time", () => {
  it("applies on the development server, and only there", () => {
    expect(
      sequenceTimeScale({ DEV: true, VITE_SEQUENCE_TIME_SCALE: "2" }),
    ).toBe(2);
    expect(
      sequenceTimeScale({ DEV: false, VITE_SEQUENCE_TIME_SCALE: "2" }),
    ).toBe(1);
  });

  it("is off unless it's set to a positive number, whatever the mission time scale", () => {
    expect(
      sequenceTimeScale({ DEV: true, VITE_MISSION_TIME_SCALE: "300" }),
    ).toBe(1);
    expect(
      sequenceTimeScale({ DEV: true, VITE_SEQUENCE_TIME_SCALE: "0" }),
    ).toBe(1);
  });
});
