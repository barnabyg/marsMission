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

/** Loaded once and kept, so that each sound starts at the moment its entry happens. */
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

/** Plays each entry's sound at the moment it happens, which keeps sounds in step at every speed. */
export function useSounds(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
): Sounds {
  const [muted, setMutedState] = useState(readMuted);
  const entriesHeard = useRef(0);

  useEffect(() => {
    loadAudio();
  }, []);

  useEffect(() => {
    // The ref stops React's development double-run of effects playing a sound twice.
    const newEntries = entries.slice(entriesHeard.current, entriesHappened);
    entriesHeard.current = entriesHappened;
    if (muted) return;
    for (const entry of newEntries) {
      const sound = soundFor(entry);
      if (sound) play(sound);
    }
  }, [entries, entriesHappened, muted]);

  return {
    muted,
    setMuted: (next) => {
      setMutedState(next);
      writeMuted(next);
      if (next) stopAll();
    },
  };
}
