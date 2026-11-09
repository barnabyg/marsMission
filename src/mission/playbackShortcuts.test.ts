import { describe, expect, it } from "vitest";
import { speeds } from "./playback";
import { playbackShortcut, speedKey } from "./playbackShortcuts";

describe("Mission Mode's keyboard shortcuts", () => {
  it("pauses and resumes on Space and mutes on M, in either case", () => {
    expect(playbackShortcut(" ")).toEqual({ kind: "pause" });
    expect(playbackShortcut("m")).toEqual({ kind: "mute" });
    expect(playbackShortcut("M")).toEqual({ kind: "mute" });
  });

  it("picks the speeds in order with the digits from 1", () => {
    expect(speeds.map((speed) => playbackShortcut(speedKey(speed)))).toEqual(
      speeds.map((speed) => ({ kind: "speed", speed })),
    );
    expect(speeds.map(speedKey)).toEqual(["1", "2", "3", "4"]);
  });

  it("does nothing for a digit past the last speed, or any other key", () => {
    expect(playbackShortcut(String(speeds.length + 1))).toBeNull();
    expect(playbackShortcut("0")).toBeNull();
    expect(playbackShortcut("Enter")).toBeNull();
    expect(playbackShortcut("p")).toBeNull();
  });
});
