/** How long a Turn takes at 1x, not counting the time text screens are up. */
const realMsPerTurn = 20 * 60_000;

/** How long a text screen stays up unless dismissed. It's real time, so it's the same at every speed. */
const textScreenMs = 8000;

export const speeds = [1, 2, 5, 10] as const;

/** The parts of a Timeline that decide how it plays. */
export interface PlaybackTimeline {
  durationDays: number;
  entries: readonly { day: number }[];
}

/** How far through a Turn Mission Mode has got. Playback only displays a Timeline and can't change it. */
export interface PlaybackState {
  day: number;
  speed: number;
  /** Index of the timeline entry on screen, during which game time holds. */
  activeEntry: number | null;
  nextEntry: number;
  textScreenRemainingMs: number;
  finished: boolean;
}

export function startPlayback(timeline: PlaybackTimeline): PlaybackState {
  return advancePlayback(
    {
      day: 0,
      speed: 1,
      activeEntry: null,
      nextEntry: 0,
      textScreenRemainingMs: 0,
      finished: false,
    },
    timeline,
    0,
    1,
  );
}

export function changeSpeed(
  state: PlaybackState,
  speed: number,
): PlaybackState {
  return { ...state, speed };
}

export function dismissEntry(state: PlaybackState): PlaybackState {
  return { ...state, activeEntry: null, textScreenRemainingMs: 0 };
}

/** Moves playback on by some real time. `timeScale` is the development-only setting and leaves text screens alone. */
export function advancePlayback(
  state: PlaybackState,
  timeline: PlaybackTimeline,
  realMs: number,
  timeScale: number,
): PlaybackState {
  const daysPerMs =
    (timeline.durationDays / realMsPerTurn) * state.speed * timeScale;
  let next = state;
  let remainingMs = realMs;

  while (!next.finished) {
    if (next.activeEntry !== null) {
      if (remainingMs < next.textScreenRemainingMs) {
        return {
          ...next,
          textScreenRemainingMs: next.textScreenRemainingMs - remainingMs,
        };
      }
      remainingMs -= next.textScreenRemainingMs;
      next = dismissEntry(next);
      continue;
    }

    const entry = timeline.entries[next.nextEntry];
    const targetDay = entry ? entry.day : timeline.durationDays;
    const msToTarget = (targetDay - next.day) / daysPerMs;
    if (remainingMs < msToTarget) {
      return { ...next, day: next.day + remainingMs * daysPerMs };
    }
    remainingMs -= msToTarget;
    next = entry
      ? {
          ...next,
          day: targetDay,
          activeEntry: next.nextEntry,
          nextEntry: next.nextEntry + 1,
          textScreenRemainingMs: textScreenMs,
        }
      : { ...next, day: targetDay, finished: true };
  }
  return next;
}
