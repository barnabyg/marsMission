import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  changeSpeed,
  msSinceEntry,
  pausePlayback,
  speeds,
  startPlayback,
  type PlaybackTimeline,
} from "./playback";

const timeline: PlaybackTimeline = {
  durationDays: 780,
  entries: [{ day: 0 }, { day: 1 }, { day: 210 }, { day: 210 }],
};

const frameMs = 16;
const minuteMs = 60_000;

function playToEnd(speed: number, timeScale = 1) {
  let state = startPlayback(timeline, speed);
  let elapsedMs = 0;
  while (!state.finished) {
    state = advancePlayback(state, timeline, frameMs, timeScale);
    elapsedMs += frameMs;
  }
  return { state, elapsedMs };
}

/** The day on which each entry first counts as having happened. */
function daysEntriesHappen(pauseEveryFrames: number | null): number[] {
  let state = startPlayback(timeline);
  const days: number[] = Array<number>(state.entriesHappened).fill(state.day);
  for (let frame = 1; !state.finished; frame++) {
    if (pauseEveryFrames && frame % pauseEveryFrames === 0) {
      state = advancePlayback(pausePlayback(state), timeline, frameMs, 1);
      state = changeSpeed(state, state.speed);
    }
    state = advancePlayback(state, timeline, frameMs, 1);
    while (days.length < state.entriesHappened) days.push(state.day);
  }
  return days;
}

describe("playing a Turn", () => {
  it("takes about 20 minutes at 1x", () => {
    const { elapsedMs } = playToEnd(1);
    expect(elapsedMs).toBeGreaterThan(19.9 * minuteMs);
    expect(elapsedMs).toBeLessThan(20.1 * minuteMs);
  });

  it("is ten times quicker at 10x", () => {
    const { elapsedMs } = playToEnd(speeds[2]);
    expect(elapsedMs).toBeGreaterThan(1.9 * minuteMs);
    expect(elapsedMs).toBeLessThan(2.1 * minuteMs);
  });

  it("reaches every entry and the end of the Turn at every speed", () => {
    for (const speed of speeds) {
      const { state } = playToEnd(speed);
      expect(state.entriesHappened).toBe(4);
      expect(state.day).toBe(780);
    }
  });

  it("has an entry on the first day happen straight away", () => {
    expect(startPlayback(timeline).entriesHappened).toBe(1);
  });

  it("counts an entry as having happened on its own day, and not before", () => {
    const realMsToDay = (day: number) => (day / 780) * 20 * minuteMs;
    const run = (realMs: number) =>
      advancePlayback(startPlayback(timeline), timeline, realMs, 1);
    expect(run(realMsToDay(209)).entriesHappened).toBe(2);
    expect(run(realMsToDay(211)).entriesHappened).toBe(4);
  });

  it("never holds game time for an entry", () => {
    let state = startPlayback(timeline);
    const dayBefore = state.day;
    state = advancePlayback(state, timeline, 1000, 1);
    expect(state.entriesHappened).toBeGreaterThan(0);
    expect(state.day).toBeGreaterThan(dayBefore);
  });

  it("can change speed at any time without moving game time", () => {
    const state = advancePlayback(startPlayback(timeline), timeline, 100, 1);
    const changed = changeSpeed(state, 10);
    expect(changed.speed).toBe(10);
    expect(changed.day).toBe(state.day);
  });

  it("runs game time faster under the development time scale", () => {
    expect(playToEnd(1, 1000).elapsedMs).toBeLessThan(minuteMs);
  });

  it("can start at the speed the player was last using", () => {
    expect(startPlayback(timeline).speed).toBe(1);
    expect(startPlayback(timeline, 10).speed).toBe(10);
  });

  it("never runs backwards, because a browser's first frame can be timed just before playback started", () => {
    const start = startPlayback(timeline);
    expect(advancePlayback(start, timeline, -5, 1)).toEqual(start);
  });

  it("stops at the end of the Turn, however large the last step", () => {
    const state = advancePlayback(
      startPlayback(timeline),
      timeline,
      60 * minuteMs,
      1,
    );
    expect(state.finished).toBe(true);
    expect(state.day).toBe(780);
  });

  describe("pausing", () => {
    const running = advancePlayback(startPlayback(timeline), timeline, 100, 1);

    it("holds game time for as long as it lasts", () => {
      const paused = pausePlayback(running);
      expect(advancePlayback(paused, timeline, 60 * minuteMs, 1)).toEqual(
        paused,
      );
    });

    it("resumes from exactly where play stopped when a speed is chosen", () => {
      const resumed = changeSpeed(pausePlayback(running), 5);
      expect(resumed.paused).toBe(false);
      expect(resumed.day).toBe(running.day);
      expect(advancePlayback(resumed, timeline, 100, 1).day).toBeGreaterThan(
        running.day,
      );
    });

    it("keeps the speed last chosen, so that the next Turn can start at it", () => {
      expect(pausePlayback(changeSpeed(running, 10)).speed).toBe(10);
    });

    it("has every entry happen on the same day as playing straight through", () => {
      expect(daysEntriesHappen(3)).toEqual(daysEntriesHappen(null));
    });
  });

  it("finishes a Turn with nothing on its timeline", () => {
    let state = startPlayback({ durationDays: 780, entries: [] });
    expect(state.entriesHappened).toBe(0);
    state = advancePlayback(
      state,
      { durationDays: 780, entries: [] },
      21 * minuteMs,
      1,
    );
    expect(state.finished).toBe(true);
    expect(state.day).toBe(780);
  });
});

describe("the time since an entry happened", () => {
  const landing: PlaybackTimeline = {
    durationDays: 780,
    entries: [{ day: 0 }, { day: 210 }],
  };
  /** At 1x, 210 days take about 5.4 minutes. */
  const toLanding = 324_000;

  const atLanding = (speed: number) =>
    advancePlayback(
      startPlayback(landing, speed),
      landing,
      toLanding / speed,
      1,
    );

  it("is nothing until the entry happens", () => {
    expect(msSinceEntry(startPlayback(landing), 1)).toBeNull();
    expect(
      msSinceEntry(
        advancePlayback(startPlayback(landing), landing, 1000, 1),
        1,
      ),
    ).toBeNull();
    expect(msSinceEntry(startPlayback(landing), 0)).toBe(0);
  });

  it("starts from the moment the entry happens", () => {
    expect(msSinceEntry(atLanding(1), 1)).toBe(0);
  });

  it.each([1, 5, 10])("counts real time at %ix", (speed) => {
    const later = advancePlayback(atLanding(speed), landing, 1500, 1);
    expect(msSinceEntry(later, 1)).toBe(1500);
  });

  it("carries on without a jump when the speed changes", () => {
    const before = advancePlayback(atLanding(1), landing, 1000, 1);
    const faster = changeSpeed(before, 10);
    expect(msSinceEntry(faster, 1)).toBe(1000);
    expect(msSinceEntry(advancePlayback(faster, landing, 500, 1), 1)).toBe(
      1500,
    );
  });

  it("stands still while paused", () => {
    const before = advancePlayback(atLanding(1), landing, 1000, 1);
    const paused = pausePlayback(before);
    expect(msSinceEntry(advancePlayback(paused, landing, 9000, 1), 1)).toBe(
      1000,
    );
  });

  it("ignores the development time scale, so that browser tests see the same length of time", () => {
    const fast = advancePlayback(startPlayback(landing), landing, 4000, 100);
    expect(fast.entriesHappened).toBe(2);
    expect(msSinceEntry(advancePlayback(fast, landing, 1000, 100), 1)).toBe(
      1000,
    );
  });
});
