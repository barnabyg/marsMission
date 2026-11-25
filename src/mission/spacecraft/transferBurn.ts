import type { TimelineEntry } from "../../simulation/simulation";
import { msSinceEntry, type PlaybackState } from "../playback";

export const transferBurnMs = 5500;
const cutoffMs = 2100;

/** A declined retry starts with the engine already off at the held Decision Point. */
export function transferCutoffMs(
  entry: Extract<TimelineEntry, { kind: "missionEvent" }>,
): number {
  return entry.contingencyAnswer === "decline" ? 0 : cutoffMs;
}

export interface TransferBurn {
  stage: "ignition" | "kickStage" | "cutoff" | "departing" | "awaitingDecision";
  elapsedMs: number;
  engine: "upperStage" | "kickStage" | null;
  /** Distance along the stack's +x axis and away from the camera. */
  travel: number;
}

/** Follow the reached burn and its recorded answer, including an unsuccessful second burn. */
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
  const secondTry = entry.contingencyAnswer === "use";
  const cutAt = transferCutoffMs(entry);
  if (entry.outcome === "failure" && elapsedMs >= cutAt) {
    // A failed retry keeps its kick stage attached while the Mission coasts.
    return {
      stage: "cutoff",
      engine: secondTry ? "kickStage" : null,
      elapsedMs,
      travel: 4.5 * (cutAt / transferBurnMs) ** 3 + (elapsedMs - cutAt) / 8500,
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
