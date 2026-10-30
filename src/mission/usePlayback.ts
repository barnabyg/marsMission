import { useEffect, useState } from "react";
import { missionTimeScale } from "./devSettings";
import {
  advancePlayback,
  changeSpeed,
  pausePlayback,
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
}

export function usePlayback(
  timeline: PlaybackTimeline,
  initialSpeed: number,
  onSpeedChange: (speed: number) => void,
): Playback {
  const [state, setState] = useState(() =>
    startPlayback(timeline, initialSpeed),
  );

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
      onSpeedChange(speed);
    },
    pause: () => {
      setState(pausePlayback);
    },
  };
}
