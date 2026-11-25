/** How long a Turn takes at 1x. */
const realMsPerTurn = 20 * 60_000;

export const speeds = [1, 5, 10, 20] as const;

/** The parts of a Timeline that decide how it plays. Its entries are in the order they happen. */
export interface PlaybackTimeline {
  durationDays: number;
  entries: readonly {
    day: number;
    title?: string;
    /** Real playing time reserved for this entry's animation. */
    sceneMs?: number;
    waitsForScene?: boolean;
  }[];
  /** The day of the Decision Point it stops at, which play can't go past until it's answered. */
  decisionDay?: number | null;
}

/** How far through a Turn Mission Mode has got. Playback only displays a Timeline and can't change it. */
export interface PlaybackState {
  day: number;
  activeScene: number | null;
  /** The speed last chosen, which play resumes at and the next Turn starts at. */
  speed: number;
  /** Holds game time until the player chooses a speed. */
  paused: boolean;
  /** How many of the timeline's entries have happened so far. */
  entriesHappened: number;
  /** Real time spent playing, at whatever speed, leaving out pauses. It paces what mustn't flash by at 20x. */
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
  const deciding = atDecisionPoint({ day }, timeline);
  let activeScene = state.activeScene;
  let updatedTimes: number[] | undefined;
  const stamp = (index: number, ms: number) => {
    updatedTimes ??= [...state.entriesPlayedMs];
    updatedTimes[index] = ms;
  };
  if (activeScene !== null) {
    const duration = timeline.entries[activeScene]?.sceneMs ?? 0;
    const elapsed = msSinceEntry(state, activeScene) ?? 0;
    if (deciding && elapsed < duration)
      stamp(activeScene, state.playedMs - duration);
    if (deciding || elapsed >= duration) activeScene = null;
  }

  let shownDay = day;
  for (
    let index = state.entriesPlayedMs.length;
    index < timeline.entries.length;
    index++
  ) {
    const entry = timeline.entries[index];
    if (!entry || entry.day > day) break;
    const duration = entry.sceneMs ?? 0;
    if (activeScene !== null && (duration > 0 || entry.waitsForScene)) {
      // Resume the calendar here once the camera is free, without banking days behind a scene.
      // Keep day-based assets on screen until their next event can actually play.
      shownDay = Math.max(
        state.day,
        timeline.entries[index - 1]?.day ?? 0,
        entry.day - 1,
      );
      break;
    }
    stamp(
      index,
      deciding && duration > 0 ? state.playedMs - duration : state.playedMs,
    );
    if (!deciding && duration > 0) activeScene = index;
  }
  const times = updatedTimes ?? state.entriesPlayedMs;
  return {
    ...state,
    activeScene,
    day: shownDay,
    entriesHappened: times.length,
    entriesPlayedMs: times,
    finished:
      !deciding &&
      day >= timeline.durationDays &&
      activeScene === null &&
      times.length === timeline.entries.length,
  };
}

export function startPlayback(
  timeline: PlaybackTimeline,
  speed = 1,
): PlaybackState {
  return atDay(
    {
      day: 0,
      activeScene: null,
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

/** Whether play is held at a Decision Point. No speed gets it moving again, only an answer. */
export function atDecisionPoint(
  state: Pick<PlaybackState, "day">,
  { decisionDay }: Pick<PlaybackTimeline, "decisionDay">,
): boolean {
  return decisionDay != null && state.day >= decisionDay;
}

/** Goes straight to the Decision Point, for Mission Mode's skip button, which can't skip it. */
export function skipToDecisionPoint(
  state: PlaybackState,
  timeline: PlaybackTimeline,
): PlaybackState {
  return timeline.decisionDay == null
    ? state
    : atDay(state, timeline, Math.max(state.day, timeline.decisionDay));
}

/**
 * Carries on from the same moment on the Timeline that an answer gives. What has already happened keeps
 * the moment it happened, and anything that's new as of now, such as the answer's outcome, happens now.
 */
export function continueOnTimeline(
  state: PlaybackState,
  previous: PlaybackTimeline,
  timeline: PlaybackTimeline,
): PlaybackState {
  const earlier = previous.entries
    .slice(0, state.entriesHappened)
    .map((entry, index) => ({
      entry,
      playedMs: state.entriesPlayedMs[index] ?? state.playedMs,
    }));
  const entriesPlayedMs: number[] = [];
  for (const entry of timeline.entries) {
    if (entry.day > state.day) break;
    const index = earlier.findIndex(
      (seen) =>
        seen.entry.day === entry.day && seen.entry.title === entry.title,
    );
    if (index < 0 && entry.day === state.day && entry.sceneMs) break;
    entriesPlayedMs.push(
      index < 0
        ? state.playedMs - (entry.sceneMs ?? 0)
        : (earlier.splice(index, 1)[0]?.playedMs ?? state.playedMs),
    );
  }
  return atDay(
    { ...state, activeScene: null, entriesPlayedMs },
    timeline,
    state.day,
  );
}

/** Retires just the visible scene. The next tick presents any waiting entry, even on the same day. */
export function skipScene(
  state: PlaybackState,
  timeline: PlaybackTimeline,
): PlaybackState {
  const index = state.activeScene;
  if (index === null) return state;
  const entriesPlayedMs = [...state.entriesPlayedMs];
  entriesPlayedMs[index] =
    state.playedMs - (timeline.entries[index]?.sceneMs ?? 0);
  return { ...state, activeScene: null, entriesPlayedMs };
}

/** Moves playback on by some real time. `timeScale` is the development-only setting. */
export function advancePlayback(
  state: PlaybackState,
  timeline: PlaybackTimeline,
  realMs: number,
  timeScale: number,
): PlaybackState {
  if (
    state.paused ||
    state.finished ||
    realMs <= 0 ||
    atDecisionPoint(state, timeline)
  ) {
    return state;
  }
  const daysPerMs =
    (timeline.durationDays / realMsPerTurn) * state.speed * timeScale;
  return atDay(
    { ...state, playedMs: state.playedMs + realMs },
    timeline,
    Math.min(
      state.day + realMs * daysPerMs,
      timeline.decisionDay ?? timeline.durationDays,
    ),
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
