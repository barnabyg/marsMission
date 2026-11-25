import type { TimelineEntry } from "../simulation/simulation";
import { launchBreakupMs, launchIgnitionMs } from "./launch/launchTiming";
import { captureCutoffMs } from "./marsOrbit/capture";
import { departureCutoffMs } from "./spacecraft/transEarthInjection";
import { cutoffMs } from "./spacecraft/transferBurn";
import { approachMs, tankerPadRate } from "./spacecraft/refuelling";
import { closingMs } from "./spacecraft/marsRendezvous";
import { breakUpMs, splashMs } from "./spacecraft/splashdown";
import { engineOutMs, ignitionMs } from "./surface/ascent";
import { impactMs } from "./surface/sequence";

export const soundFileNames = {
  launch: "launch.wav",
  failure: "failure.wav",
  milestone: "milestone.wav",
  fundingThreshold: "funding-threshold.wav",
  rendezvous: "rendezvous.wav",
  crewLost: "crew-lost.wav",
  crewHome: "crew-home.wav",
} as const;

export type SoundName = keyof typeof soundFileNames;

/** The Mission Events with a sound of their own when they succeed. A tanker, and Mars ascent, lift off as the Mission did. */
const successSounds: Partial<Record<string, SoundName>> = {
  launch: "launch",
  "tanker-launch": "launch",
  "mars-ascent": "launch",
  rendezvous: "rendezvous",
};

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
  if (entry.kind === "crewLost") return "crewLost";
  if (entry.kind === "crewHome") return "crewHome";
  if (entry.kind === "assetFailed" || entry.kind === "decisionPoint") {
    return "failure";
  }
  return entry.kind === "milestone" || entry.kind === "fundingThreshold"
    ? entry.kind
    : null;
}

/** A cue begins either with its card, or at a visible moment on a scene's playing clock. */
interface SoundCue {
  name: SoundName;
  key: string;
  entryIndex: number;
  sceneIndex: number | null;
  afterMs: number;
}

function actionMs(
  entry: Extract<TimelineEntry, { kind: "missionEvent" }>,
): number | null {
  const failed = entry.outcome === "failure";
  switch (entry.eventId) {
    case "mars-orbit-insertion":
      return failed ? captureCutoffMs : null;
    case "trans-earth-injection":
      return failed ? departureCutoffMs : null;
    case "mars-transfer-burn":
      return failed ? cutoffMs : null;
    case "launch":
      return failed ? launchBreakupMs : launchIgnitionMs;
    case "tanker-launch":
      return (failed ? launchBreakupMs : launchIgnitionMs) / tankerPadRate;
    case "rendezvous":
      return approachMs;
    case "entry-descent-landing":
      return failed ? impactMs : null;
    case "mars-ascent":
      return failed ? engineOutMs : ignitionMs;
    case "mars-orbit-rendezvous":
      return closingMs;
    case "earth-entry":
      return failed ? breakUpMs : splashMs;
    default:
      return null;
  }
}

/** The order matches the Timeline, including Crew lost alongside the breakup that caused it. */
export function soundCues(entries: readonly TimelineEntry[]): SoundCue[] {
  const cues: SoundCue[] = [];
  const occurrences = new Map<string, number>();
  let eventIndex = -1;
  entries.forEach((entry, entryIndex) => {
    // An answer can replace or rearrange the held Timeline. Keep the identity of an already-heard cue.
    const identity = JSON.stringify([entry.day, entry.kind, entry.title]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const cue = (
      name: SoundName,
      sceneIndex: number | null,
      afterMs: number,
    ) => {
      cues.push({
        key: JSON.stringify([identity, occurrence, name]),
        name,
        entryIndex,
        sceneIndex,
        afterMs,
      });
    };
    if (entry.kind === "missionEvent") {
      eventIndex = entryIndex;
      if (
        (entry.eventId === "launch" || entry.eventId === "tanker-launch") &&
        entry.outcome === "failure"
      ) {
        cue(
          "launch",
          entryIndex,
          entry.eventId === "launch"
            ? launchIgnitionMs
            : launchIgnitionMs / tankerPadRate,
        );
      }
    }
    const name = soundFor(entry);
    if (!name) return;
    const event = entries[eventIndex];
    if (
      event?.kind === "missionEvent" &&
      event.day === entry.day &&
      (eventIndex === entryIndex ||
        (entry.kind === "crewLost" && event.outcome === "failure") ||
        (entry.kind === "crewHome" && event.eventId === "earth-entry"))
    ) {
      const afterMs = actionMs(event);
      if (afterMs !== null) {
        cue(name, eventIndex, afterMs);
        return;
      }
    }
    cue(name, null, 0);
  });
  return cues;
}
