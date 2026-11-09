import { useEffect, useEffectEvent } from "react";
import { keyPlace } from "../ui/shortcuts";
import { playbackShortcut, type Speed } from "./playbackShortcuts";

interface PlaybackKeys {
  paused: boolean;
  /** Whether play is held at a Decision Point, where only an answer moves it on, so pausing and the speeds wait. */
  deciding: boolean;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: Speed) => void;
  toggleMute: () => void;
}

/**
 * Mission Mode's keyboard shortcuts (playbackShortcuts.ts), anywhere on the page except while typing or with a dialog
 * open. Space presses a focused button, as it always does, unless that button is one of the playback controls, where
 * it pauses or resumes instead, so that it never does both.
 */
export function usePlaybackShortcuts(keys: PlaybackKeys) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const place = keyPlace(event);
    const shortcut = place === "blocked" ? null : playbackShortcut(event.key);
    if (!shortcut) return;
    if (shortcut.kind === "mute") {
      event.preventDefault();
      keys.toggleMute();
      return;
    }
    if (keys.deciding) return;
    if (shortcut.kind === "speed") {
      event.preventDefault();
      keys.setSpeed(shortcut.speed);
      return;
    }
    const onPlayback =
      event.target instanceof Element &&
      event.target.closest(".mission-playback") !== null;
    if (place === "control" && !onPlayback) return;
    event.preventDefault();
    if (keys.paused) keys.resume();
    else keys.pause();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      onKey(event);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);
}
