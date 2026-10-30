import { useEffect, useState } from "react";
import { missionTimeScale } from "./devSettings";
import {
  advancePlayback,
  changeSpeed,
  dismissEntry,
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
  dismiss: () => void;
}

export function usePlayback(timeline: PlaybackTimeline): Playback {
  const [state, setState] = useState(() => startPlayback(timeline));

  useEffect(() => {
    let previous = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const realMs = Math.min(now - previous, maxFrameMs);
      previous = now;
      setState((current) =>
        advancePlayback(current, timeline, realMs, timeScale),
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
      setState((current) => changeSpeed(current, speed));
    },
    dismiss: () => {
      setState(dismissEntry);
    },
  };
}
