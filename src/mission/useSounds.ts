import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import type { PlaybackState } from "./playback";
import { soundCues, soundFileNames, type SoundName } from "./sounds";

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

interface PlayingSound {
  audio: HTMLAudioElement;
  sceneIndex: number | null;
  held: boolean;
  entryIndex: number;
}

interface Sounds {
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

/** Playback owns the clock and the active scene. The browser only plays the samples. */
export function useSounds(
  entries: readonly TimelineEntry[],
  {
    activeScene,
    playedMs,
    entriesPlayedMs,
    entriesHappened,
    paused,
  }: PlaybackState,
  deciding: boolean,
): Sounds {
  const [muted, setMutedState] = useState(readMuted);
  const cues = useMemo(() => soundCues(entries), [entries]);
  const heard = useRef(new Set<string>());
  const playing = useRef(new Map<SoundName, PlayingSound>());

  useEffect(() => {
    loadAudio();
    const tracks = playing.current;
    return () => {
      for (const { audio } of tracks.values()) audio.pause();
      tracks.clear();
    };
  }, []);

  useEffect(() => {
    const tracks = playing.current;
    const decisionIndex = deciding
      ? entries
          .slice(0, entriesHappened)
          .findLastIndex((entry) => entry.kind === "decisionPoint")
      : -1;
    for (const [name, track] of tracks) {
      if (
        track.audio.ended ||
        (deciding && track.entryIndex !== decisionIndex) ||
        muted ||
        (track.sceneIndex !== null && track.sceneIndex !== activeScene)
      ) {
        track.audio.pause();
        tracks.delete(name);
      } else if (paused && !track.held) {
        track.audio.pause();
        tracks.set(name, { ...track, held: true });
      } else if (!paused && track.held) {
        tracks.set(name, { ...track, held: false });
        void track.audio.play().catch(() => undefined);
      }
    }

    for (const cue of cues) {
      if (cue.entryIndex >= entriesHappened) break;
      if (heard.current.has(cue.key)) continue;
      // Skip retires a scene and its remaining cues. A Decision Point preempts even same-frame events.
      if (
        (deciding && cue.entryIndex !== decisionIndex) ||
        (cue.sceneIndex !== null && activeScene !== cue.sceneIndex)
      ) {
        heard.current.add(cue.key);
        continue;
      }
      if (
        cue.sceneIndex !== null &&
        playedMs - (entriesPlayedMs[cue.sceneIndex] ?? playedMs) < cue.afterMs
      )
        continue;
      if (paused && !muted && !deciding) continue;
      heard.current.add(cue.key);
      if (muted) continue;
      const audio = loadAudio()[cue.name];
      if (!audio) continue;
      audio.currentTime = 0;
      tracks.set(cue.name, {
        audio,
        sceneIndex: cue.sceneIndex,
        entryIndex: cue.entryIndex,
        held: false,
      });
      // A sound that can't load or isn't allowed to play just stays silent.
      void audio.play().catch(() => undefined);
    }
  }, [
    entries,
    cues,
    entriesHappened,
    entriesPlayedMs,
    playedMs,
    activeScene,
    deciding,
    muted,
    paused,
  ]);

  return {
    muted,
    setMuted: (next) => {
      setMutedState(next);
      writeMuted(next);
    },
  };
}
