import type { TimelineEntry } from "../../simulation/simulation";
import { msSinceEntry, type PlaybackState } from "../playback";

export const transferBurnMs = 5500;
export const cutoffMs = 2100;

export interface TransferBurn {
  stage: "ignition" | "kickStage" | "cutoff" | "departing" | "awaitingDecision";
  elapsedMs: number;
  engine: "upperStage" | "kickStage" | null;
  /** Distance along the stack's +x axis and away from the camera. */
  travel: number;
}

/** Follow only a reached burn or its held decision. The answered Timeline retains the decision
 * entry, so a successful second burn can show the kick stage without guessing the player's choice. */
export function transferBurnNow(
  entries: readonly TimelineEntry[],
  state: PlaybackState,
  deciding: boolean,
): TransferBurn | null {
  const index = state.activeScene;
  if (index === null) {
    const question = deciding
      ? entries
          .slice(0, state.entriesHappened)
          .findLast((entry) => entry.kind === "decisionPoint")
      : undefined;
    return question?.eventId === "mars-transfer-burn"
      ? { stage: "awaitingDecision", engine: null, elapsedMs: 0, travel: 0 }
      : null;
  }
  const entry = entries[index];
  if (entry?.kind !== "missionEvent" || entry.eventId !== "mars-transfer-burn")
    return null;
  const elapsedMs = msSinceEntry(state, index) ?? 0;
  const secondTry = entries
    .slice(0, index)
    .some(
      (previous) =>
        previous.kind === "decisionPoint" && previous.eventId === entry.eventId,
    );
  if (entry.outcome === "failure" && (secondTry || elapsedMs >= cutoffMs)) {
    // After cutoff the intact stage coasts away much more slowly than a departing Mission.
    const driftMs = secondTry ? elapsedMs : elapsedMs - cutoffMs;
    return {
      stage: "cutoff",
      engine: null,
      elapsedMs,
      travel: 4.5 * (cutoffMs / transferBurnMs) ** 3 + driftMs / 8500,
    };
  }
  const share = Math.min(elapsedMs / transferBurnMs, 1);
  return {
    stage:
      elapsedMs >= cutoffMs
        ? "departing"
        : secondTry
          ? "kickStage"
          : "ignition",
    elapsedMs,
    travel: 4.5 * share ** 3,
    engine: secondTry ? "kickStage" : "upperStage",
  };
}

export const burnStatus: Record<TransferBurn["stage"], string> = {
  ignition: "Mars transfer burn: the upper stage is firing",
  kickStage: "The kick stage is firing for a second try",
  departing: "The Mission is leaving Earth orbit for Mars",
  cutoff: "Early engine cutoff: the Mission will miss Mars",
  awaitingDecision: "The upper stage has shut down early",
};
