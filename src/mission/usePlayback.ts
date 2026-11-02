import { useEffect, useState } from "react";
import { missionTimeScale } from "./devSettings";
import {
  advancePlayback,
  changeSpeed,
  continueOnTimeline,
  pausePlayback,
  skipToDecisionPoint,
  startPlayback,
  type PlaybackState,
  type PlaybackTimeline,
} from "./playback";

/** Longest step for one frame, so that returning to a hidden tab doesn't jump the Turn forward. */
const maxFrameMs = 250;

const timeScale = missionTimeScale(import.meta.env);

interface Playback {
  state: PlaybackState;
  setSpeed: (speed: number) => void;
  pause: () => void;
  skipToDecision: () => void;
}

/** The playback state, kept with the Timeline it's for. */
interface Stored {
  timeline: PlaybackTimeline;
  state: PlaybackState;
}

/** The state on this Timeline, worked out from the one before if an answer has brought a new one since. */
function onTimeline(stored: Stored, timeline: PlaybackTimeline): PlaybackState {
  return stored.timeline === timeline
    ? stored.state
    : continueOnTimeline(stored.state, stored.timeline, timeline);
}

/** Applies a change on this Timeline, keeping the same object if nothing changed, as while paused, so nothing renders again. */
function changed(
  stored: Stored,
  timeline: PlaybackTimeline,
  change: (current: PlaybackState) => PlaybackState,
): Stored {
  const current = onTimeline(stored, timeline);
  const next = change(current);
  return next === current && stored.timeline === timeline
    ? stored
    : { timeline, state: next };
}

export function usePlayback(
  timeline: PlaybackTimeline,
  initialSpeed: number,
  onSpeedChange: (speed: number) => void,
): Playback {
  // An answer brings a new Timeline. The state on it is worked out from the one before as it renders, so no frame ever
  // shows the old state on it, even while paused, and the next change keeps it.
  const [stored, setStored] = useState<Stored>(() => ({
    timeline,
    state: startPlayback(timeline, initialSpeed),
  }));
  const state = onTimeline(stored, timeline);
  const update = (change: (current: PlaybackState) => PlaybackState) => {
    setStored((current) => changed(current, timeline, change));
  };

  useEffect(() => {
    let previous = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const realMs = Math.min(now - previous, maxFrameMs);
      previous = now;
      setStored((current) =>
        changed(current, timeline, (state) =>
          advancePlayback(state, timeline, realMs, timeScale),
        ),
      );
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [timeline]);

  return {
    state,
    setSpeed: (speed) => {
      update((current) => changeSpeed(current, speed));
      onSpeedChange(speed);
    },
    pause: () => {
      update(pausePlayback);
    },
    skipToDecision: () => {
      update((current) => skipToDecisionPoint(current, timeline));
    },
  };
}
