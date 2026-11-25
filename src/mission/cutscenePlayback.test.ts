import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  startPlayback,
  continueOnTimeline,
  skipScene,
  pausePlayback,
  changeSpeed,
} from "./playback";

describe.each([1, 20])("cutscenes at %ix", (speed) => {
  it("plays outbound and homeward scenes in Timeline order through the end of the Turn", () => {
    const timeline = {
      durationDays: 10,
      entries: [
        { day: 0, title: "Launch", sceneMs: 9000 },
        { day: 10, title: "Landing", sceneMs: 7000 },
        { day: 10, title: "Mars ascent", sceneMs: 7000 },
      ],
    };
    const tick = (state: ReturnType<typeof startPlayback>, ms: number) =>
      advancePlayback(state, timeline, ms, 1_200_000);
    const start = startPlayback(timeline, speed);
    const arrived = tick(start, 1000);
    expect(arrived.activeScene).toBe(0);
    expect(arrived.finished).toBe(false);
    const landing = tick(arrived, 8000);
    expect(landing.activeScene).toBe(1);
    const ascent = tick(landing, 7000);
    expect(ascent.activeScene).toBe(2);
    expect(tick(ascent, 6999).finished).toBe(false);
    expect(tick(ascent, 7000).finished).toBe(true);
  });
});

it("skips just the paused scene and gives the next same-day scene its full duration", () => {
  const timeline = {
    durationDays: 2,
    entries: [
      { day: 0, title: "Launch", sceneMs: 9000 },
      { day: 0, title: "Mars ascent", sceneMs: 7000 },
    ],
  };
  const held = pausePlayback(
    advancePlayback(startPlayback(timeline), timeline, 300, 1),
  );
  const skipped = skipScene(held, timeline);
  expect(skipped.activeScene).toBeNull();
  expect(advancePlayback(skipped, timeline, 5000, 1)).toEqual(skipped);
  const resumed = advancePlayback(changeSpeed(skipped, 20), timeline, 16, 1);
  expect(resumed.activeScene).toBe(1);
  expect(advancePlayback(resumed, timeline, 6999, 1).activeScene).toBe(1);
  expect(advancePlayback(resumed, timeline, 7000, 1).activeScene).toBeNull();
});

it("preempts the queue at a Decision Point and plays only new scenes from the answer", () => {
  const launch = { day: 0, title: "Launch", sceneMs: 9000 };
  const tanker = { day: 1, title: "Tanker launch", sceneMs: 2500 };
  const question = { day: 2, title: "Trouble" };
  const before = {
    durationDays: 10,
    decisionDay: 2,
    entries: [launch, tanker, question],
  };
  const held = advancePlayback(startPlayback(before, 20), before, 12_000, 1);
  expect(held.activeScene).toBeNull();
  expect(held.finished).toBe(false);
  for (const title of ["Rendezvous saved", "Rendezvous failed"]) {
    const answered = {
      durationDays: 10,
      entries: [
        launch,
        { day: 0, title: "Funding Threshold reached" },
        tanker,
        question,
        { day: 2, title, sceneMs: 6500 },
      ],
    };
    const after = continueOnTimeline(held, before, answered);
    expect(after.activeScene).toBe(4);
    expect(after.entriesPlayedMs[1]).toBe(held.playedMs);
    expect(after.speed).toBe(20);
  }
});
