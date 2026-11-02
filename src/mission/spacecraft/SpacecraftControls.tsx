import type { Timeline } from "../../simulation/simulation";
import { GameText } from "../../ui/GameText";
import type { MissionViewId } from "../missionViews";
import { assetsOnBoard } from "./spacecraft";

/** Ties the reason on screen to the disabled button it explains. */
export const spacecraftUnavailableId = "spacecraft-unavailable";

interface SpacecraftControlsProps {
  timeline: Pick<Timeline, "mission">;
  day: number;
  view: MissionViewId;
  /** Whether the spacecraft view has anything to show. */
  available: boolean;
  /** Whether a solar particle event is sweeping past. */
  particles: boolean;
}

/** Why the spacecraft view can't be chosen, or else what's on board and what's happening to it. */
export function SpacecraftControls({
  timeline,
  day,
  view,
  available,
  particles,
}: SpacecraftControlsProps) {
  if (!available) {
    return (
      <p id={spacecraftUnavailableId} data-testid={spacecraftUnavailableId}>
        <GameText>Spacecraft view: no Mission is in flight.</GameText>
      </p>
    );
  }
  if (view !== "spacecraft") return null;
  return (
    <>
      <h2>On board</h2>
      <ul data-testid="spacecraft-status">
        {[
          ...(particles
            ? ["Solar particle event: radiation sweeping past"]
            : []),
          ...assetsOnBoard(timeline.mission, day).map(({ name, kind, lost }) =>
            lost ? `${name} (${kind}): lost on the way` : `${name} (${kind})`,
          ),
        ].map((line) => (
          <li key={line}>
            <GameText>{line}</GameText>
          </li>
        ))}
      </ul>
    </>
  );
}
