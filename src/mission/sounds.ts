import type { TimelineEntry } from "../simulation/simulation";

export const soundFileNames = {
  launch: "launch.wav",
  failure: "failure.wav",
  milestone: "milestone.wav",
  fundingThreshold: "funding-threshold.wav",
} as const;

export type SoundName = keyof typeof soundFileNames;

/** The Mission Events with a sound of their own when they succeed. */
const successSounds: Partial<Record<string, SoundName>> = { launch: "launch" };

/**
 * Matches each timeline entry to its sound, or null to play silently. This is the only place that
 * does, and it only reads the Timeline, so adding a sound can't change any rules.
 */
export function soundFor(entry: TimelineEntry): SoundName | null {
  if (entry.kind === "missionEvent") {
    return entry.outcome === "failure"
      ? "failure"
      : (successSounds[entry.eventId] ?? null);
  }
  return entry.kind === "firstLanding" || entry.kind === "survey"
    ? null
    : entry.kind;
}
