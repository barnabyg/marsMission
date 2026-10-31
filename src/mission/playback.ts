/** How long a Turn takes at 1x. */
const realMsPerTurn = 20 * 60_000;

export const speeds = [1, 5, 10] as const;

/** The parts of a Timeline that decide how it plays. Its entries are in the order they happen. */
export interface PlaybackTimeline {
  durationDays: number;
  entries: readonly { day: number }[];
}

/** How far through a Turn Mission Mode has got. Playback only displays a Timeline and can't change it. */
export interface PlaybackState {
  day: number;
  /** The speed last chosen, which play resumes at and the next Turn starts at. */
  speed: number;
  /** Holds game time until the player chooses a speed. */
  paused: boolean;
  /** How many of the timeline's entries have happened so far. */
  entriesHappened: number;
  /** Real time spent playing, at whatever speed, leaving out pauses. It paces what mustn't flash by at 10x. */
  playedMs: number;
  /** The value of playedMs when each entry so far happened. */
  entriesPlayedMs: readonly number[];
  finished: boolean;
}

function atDay(
  state: PlaybackState,
  timeline: PlaybackTimeline,
  day: number,
): PlaybackState {
  const entriesHappened = timeline.entries.filter(
    (entry) => entry.day <= day,
  ).length;
  const { entriesPlayedMs, playedMs } = state;
  return {
    ...state,
    day,
    entriesHappened,
    entriesPlayedMs:
      entriesHappened === entriesPlayedMs.length
        ? entriesPlayedMs
        : [
            ...entriesPlayedMs,
            ...Array.from(
              { length: entriesHappened - entriesPlayedMs.length },
              () => playedMs,
            ),
          ],
    finished: day >= timeline.durationDays,
  };
}

export function startPlayback(
  timeline: PlaybackTimeline,
  speed = 1,
): PlaybackState {
  return atDay(
    {
      day: 0,
      speed,
      paused: false,
      entriesHappened: 0,
      playedMs: 0,
      entriesPlayedMs: [],
      finished: false,
    },
    timeline,
    0,
  );
}

export function changeSpeed(
  state: PlaybackState,
  speed: number,
): PlaybackState {
  return { ...state, speed, paused: false };
}

export function pausePlayback(state: PlaybackState): PlaybackState {
  return { ...state, paused: true };
}

/** Moves playback on by some real time. `timeScale` is the development-only setting. */
export function advancePlayback(
  state: PlaybackState,
  timeline: PlaybackTimeline,
  realMs: number,
  timeScale: number,
): PlaybackState {
  if (state.paused || state.finished || realMs <= 0) return state;
  const daysPerMs =
    (timeline.durationDays / realMsPerTurn) * state.speed * timeScale;
  return atDay(
    { ...state, playedMs: state.playedMs + realMs },
    timeline,
    Math.min(state.day + realMs * daysPerMs, timeline.durationDays),
  );
}

/** How much real play has passed since an entry happened, or null if it hasn't yet. */
export function msSinceEntry(
  state: Pick<PlaybackState, "playedMs" | "entriesPlayedMs">,
  entryIndex: number,
): number | null {
  const playedMs = state.entriesPlayedMs[entryIndex];
  return playedMs === undefined ? null : state.playedMs - playedMs;
}
