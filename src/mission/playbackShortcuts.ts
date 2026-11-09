import { speeds } from "./playback";

export type Speed = (typeof speeds)[number];

/** What a key does in Mission Mode, if anything. */
export type PlaybackShortcut =
  { kind: "pause" } | { kind: "speed"; speed: Speed } | { kind: "mute" };

/** How each shortcut's key is named in its button's tooltip. */
export const pauseKeyName = "Space";
export const muteKeyName = "M";

/** The digit that picks a speed: the speeds in order from 1, slowest first. */
export function speedKey(speed: Speed): string {
  return String(speeds.indexOf(speed) + 1);
}

/** The shortcut for a key, as `KeyboardEvent.key` names it: Space pauses and resumes, a digit picks a speed, M mutes. */
export function playbackShortcut(key: string): PlaybackShortcut | null {
  if (key === " ") return { kind: "pause" };
  if (key === "m" || key === "M") return { kind: "mute" };
  const speed = /^[1-9]$/.test(key) ? speeds[Number(key) - 1] : undefined;
  return speed === undefined ? null : { kind: "speed", speed };
}
