import { useEffect, useRef, useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import { soundFileNames, soundFor, type SoundName } from "./sounds";

const mutedKey = "marsMission.muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(mutedKey) === "true";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(mutedKey, String(muted));
  } catch {
    // Without storage the setting lasts until the page closes, which is no reason to stop the game.
  }
}

/** Loaded once and kept, so that each sound starts as soon as its entry is on screen. */
let audioElements: Partial<Record<SoundName, HTMLAudioElement>> | null = null;

function loadAudio(): Partial<Record<SoundName, HTMLAudioElement>> {
  audioElements ??= Object.fromEntries(
    Object.entries(soundFileNames).map(([name, fileName]) => [
      name,
      new Audio(`${import.meta.env.BASE_URL}sounds/${fileName}`),
    ]),
  );
  return audioElements;
}

function play(name: SoundName): void {
  const audio = loadAudio()[name];
  if (!audio) return;
  audio.currentTime = 0;
  // A sound that can't load or isn't allowed to play just stays silent.
  audio.play().catch(() => undefined);
}

function stopAll(): void {
  for (const audio of Object.values(loadAudio())) audio.pause();
}

interface Sounds {
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

/**
 * Plays an entry's sound when Mission Mode puts it on screen. Game time holds while an entry is up,
 * and only one can be up at a time, so sounds stay in step at every speed.
 */
export function useSounds(
  entries: readonly TimelineEntry[],
  activeEntry: number | null,
): Sounds {
  const [muted, setMutedState] = useState(readMuted);
  const lastPlayed = useRef<number | null>(null);

  useEffect(() => {
    loadAudio();
  }, []);

  useEffect(() => {
    // The ref stops React's development double-run of effects playing a sound twice.
    if (activeEntry === null || activeEntry === lastPlayed.current) return;
    lastPlayed.current = activeEntry;
    const entry = entries[activeEntry];
    const sound = entry ? soundFor(entry) : null;
    if (sound && !muted) play(sound);
  }, [entries, activeEntry, muted]);

  return {
    muted,
    setMuted: (next) => {
      setMutedState(next);
      writeMuted(next);
      if (next) stopAll();
    },
  };
}
