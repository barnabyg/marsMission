import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  changeSpeed,
  dismissEntry,
  pausePlayback,
  speeds,
  startPlayback,
  type PlaybackState,
  type PlaybackTimeline,
} from "./playback";

const timeline: PlaybackTimeline = {
  durationDays: 780,
  entries: [{ day: 0 }, { day: 1 }, { day: 210 }],
};

const frameMs = 16;
const minuteMs = 60_000;

function playToEnd(speed: number, timeScale = 1) {
  let state = changeSpeed(startPlayback(timeline), speed);
  let elapsedMs = 0;
  const shown: number[] = [];
  const shownForMs = new Map<number, number>();
  while (!state.finished) {
    state = advancePlayback(state, timeline, frameMs, timeScale);
    elapsedMs += frameMs;
    if (state.activeEntry !== null) {
      const { activeEntry } = state;
      if (!shown.includes(activeEntry)) shown.push(activeEntry);
      shownForMs.set(activeEntry, (shownForMs.get(activeEntry) ?? 0) + frameMs);
    }
  }
  return { state, elapsedMs, shown, shownForMs };
}

describe("playing a Turn", () => {
  it("takes about 20 minutes at 1x", () => {
    const { elapsedMs } = playToEnd(1);
    expect(elapsedMs).toBeGreaterThan(19 * minuteMs);
    expect(elapsedMs).toBeLessThan(22 * minuteMs);
  });

  it("is about ten times quicker at 10x", () => {
    const { elapsedMs } = playToEnd(10);
    expect(elapsedMs).toBeGreaterThan(2 * minuteMs);
    expect(elapsedMs).toBeLessThan(3 * minuteMs);
  });

  it("shows the same entries in the same order at every speed", () => {
    for (const speed of speeds) {
      const { shown, state } = playToEnd(speed);
      expect(shown).toEqual([0, 1, 2]);
      expect(state.day).toBe(780);
    }
  });

  it("keeps a text screen up for the same real time at every speed", () => {
    const slow = playToEnd(1).shownForMs;
    const fast = playToEnd(10).shownForMs;
    for (const entry of [0, 1, 2]) {
      expect(fast.get(entry)).toBeGreaterThanOrEqual(6000);
      expect(
        Math.abs((fast.get(entry) ?? 0) - (slow.get(entry) ?? 0)),
      ).toBeLessThanOrEqual(frameMs);
    }
  });

  it("doesn't let game time pass while a text screen is up", () => {
    let state = startPlayback(timeline);
    state = advancePlayback(state, timeline, 1000, 1);
    expect(state.activeEntry).toBe(0);
    expect(state.day).toBe(0);
  });

  it("carries on as soon as the player dismisses a text screen", () => {
    let state = advancePlayback(startPlayback(timeline), timeline, 100, 1);
    state = dismissEntry(state);
    expect(state.activeEntry).toBeNull();
    state = advancePlayback(state, timeline, 1000, 1);
    expect(state.day).toBeGreaterThan(0);
  });

  it("can change speed at any time without moving game time", () => {
    let state: PlaybackState = dismissEntry(
      advancePlayback(startPlayback(timeline), timeline, 100, 1),
    );
    const { day } = state;
    state = changeSpeed(state, 10);
    expect(state.speed).toBe(10);
    expect(state.day).toBe(day);
  });

  it("lets game time run ten times faster at 10x", () => {
    const run = (speed: number) => {
      let state = dismissEntry(
        advancePlayback(
          changeSpeed(startPlayback(timeline), speed),
          timeline,
          100,
          1,
        ),
      );
      state = advancePlayback(state, timeline, 100, 1);
      return state.day;
    };
    expect(run(10)).toBeCloseTo(run(1) * 10);
  });

  it("runs game time faster under the development time scale, leaving text screens alone", () => {
    const quick = playToEnd(1, 1000);
    expect(quick.elapsedMs).toBeLessThan(minuteMs);
    expect(quick.shownForMs.get(0)).toBe(playToEnd(1).shownForMs.get(0));
  });

  it("can start at the speed the player was last using", () => {
    expect(startPlayback(timeline).speed).toBe(1);
    expect(startPlayback(timeline, 10).speed).toBe(10);
  });

  it("offers 1x, 5x and 10x", () => {
    expect(speeds).toEqual([1, 5, 10]);
  });

  describe("pausing", () => {
    const running = dismissEntry(
      advancePlayback(startPlayback(timeline), timeline, 100, 1),
    );

    it("holds game time for as long as it lasts", () => {
      const moved = advancePlayback(running, timeline, 1000, 1);
      const paused = pausePlayback(moved);
      expect(advancePlayback(paused, timeline, 60 * minuteMs, 1).day).toBe(
        moved.day,
      );
    });

    it("holds a text screen's time too", () => {
      const shown = advancePlayback(startPlayback(timeline), timeline, 100, 1);
      const held = advancePlayback(
        pausePlayback(shown),
        timeline,
        60 * minuteMs,
        1,
      );
      expect(held.activeEntry).toBe(0);
      expect(held.textScreenRemainingMs).toBe(shown.textScreenRemainingMs);
    });

    it("resumes from exactly where play stopped when a speed is chosen", () => {
      const paused = pausePlayback(running);
      const resumed = changeSpeed(paused, 5);
      expect(resumed.paused).toBe(false);
      expect(resumed.day).toBe(running.day);
      expect(advancePlayback(resumed, timeline, 100, 1).day).toBeGreaterThan(
        running.day,
      );
    });

    it("keeps the speed last chosen, so that play can return to it", () => {
      const paused = pausePlayback(changeSpeed(running, 10));
      expect(paused.speed).toBe(10);
    });

    it("shows the same entries on the same days as playing straight through", () => {
      const entriesWithDays = (pauseEveryFrames: number | null) => {
        let state = startPlayback(timeline);
        const seen: [number, number][] = [];
        for (let frame = 0; !state.finished; frame++) {
          if (pauseEveryFrames && frame % pauseEveryFrames === 0) {
            state = advancePlayback(pausePlayback(state), timeline, frameMs, 1);
            state = changeSpeed(state, state.speed);
          }
          state = advancePlayback(state, timeline, 8000, 1);
          if (state.activeEntry !== null) {
            const { activeEntry, day } = state;
            if (!seen.some(([entry]) => entry === activeEntry)) {
              seen.push([activeEntry, day]);
            }
          }
        }
        return { seen, day: state.day };
      };
      expect(entriesWithDays(3)).toEqual(entriesWithDays(null));
    });
  });

  it("finishes a Turn with nothing on its timeline", () => {
    let state = startPlayback({ durationDays: 780, entries: [] });
    expect(state.activeEntry).toBeNull();
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
