import type { Timeline } from "../../simulation/simulation";
import { msSinceEntry, type PlaybackState } from "../playback";
import { viewAskedForBy, type MissionViewId } from "../missionViews";
import type { CameraPose } from "../sceneParts";

export const captureMs = 6200;
const burnMs = 3000;

// The close view looks along the limb. Pull back after cutoff to show the curve or the escape.
export const limbShot: CameraPose = {
  position: [-0.38, 1.55, -18.2],
  target: [-0.38, 1.29, -20],
};
export const captureWideShot: CameraPose = {
  position: [0.35, 1.45, -17.2],
  target: [0.35, 0.65, -20],
};

export function marsCaptureNow(
  timeline: Timeline,
  state: PlaybackState,
  view: MissionViewId,
) {
  const index = state.activeScene;
  if (index === null) return null;
  const entry = timeline.entries[index];
  if (
    entry?.kind !== "missionEvent" ||
    entry.eventId !== "mars-orbit-insertion" ||
    view !== viewAskedForBy(entry) ||
    !timeline.mission
  )
    return null;
  const elapsed = msSinceEntry(state, index) ?? 0;
  const stage =
    elapsed < burnMs ? "burn" : entry.outcome === "failure" ? "flyby" : "orbit";
  const progress = Math.max(0, (elapsed - burnMs) / (captureMs - burnMs));
  const angle = progress * 1.14;
  const x =
    stage === "burn"
      ? -0.48 * (1 - elapsed / burnMs)
      : stage === "orbit"
        ? 1.23 * Math.sin(angle)
        : progress * 1.65;
  const y =
    stage === "orbit" ? 1.23 * Math.cos(angle) : 1.23 + Math.max(0, -x) * 0.12;
  // The braking engine faces into the direction of travel.
  const pitch = Math.PI - (stage === "orbit" ? angle : 0);
  const onBoard = timeline.mission.assets
    .filter(
      ({ lostOnDay, deliveredOnDay }) =>
        (lostOnDay === null || lostOnDay >= entry.day) &&
        (deliveredOnDay === null || deliveredOnDay >= entry.day),
    )
    .map(({ kind, name }) => ({ kind, name, lost: false }));
  return { stage, x, y, pitch, onBoard, day: entry.day };
}

export type MarsCapture = NonNullable<ReturnType<typeof marsCaptureNow>>;
