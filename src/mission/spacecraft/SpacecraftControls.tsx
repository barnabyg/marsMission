import type { Timeline } from "../../simulation/simulation";
import { GameText } from "../../ui/GameText";
import type { MissionViewId } from "../missionViews";
import { earthOrbitStatus, type EarthOrbitNow } from "./refuelling";
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
  /** The Mission in Earth orbit for Orbital refuelling, if it's there. */
  earthOrbit: EarthOrbitNow | null;
}

/** How the player reads a kind on board, where the Crew's ship is named for its Crew. */
function kindName(kind: string): string {
  return kind === "crew" ? "Crew" : kind;
}

/** What's on board, each Asset with its kind, and whether it's lost. */
function onBoardLines(
  timeline: Pick<Timeline, "mission">,
  day: number,
  earthOrbit: EarthOrbitNow | null,
): string[] {
  if (earthOrbit) {
    return (timeline.mission?.assets ?? []).map(({ name, kind }) =>
      earthOrbit.missionLost
        ? `${name} (${kindName(kind)}): lost in Earth orbit`
        : `${name} (${kindName(kind)})`,
    );
  }
  return assetsOnBoard(timeline.mission, day).map(({ name, kind, lost }) =>
    lost
      ? `${name} (${kindName(kind)}): lost on the way`
      : `${name} (${kindName(kind)})`,
  );
}

/** Why the spacecraft view can't be chosen, or else what's on board and what's happening to it. */
export function SpacecraftControls({
  timeline,
  day,
  view,
  available,
  particles,
  earthOrbit,
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
          ...[earthOrbitStatus(earthOrbit) ?? []].flat(),
          ...onBoardLines(timeline, day, earthOrbit),
        ].map((line) => (
          <li key={line}>
            <GameText>{line}</GameText>
          </li>
        ))}
      </ul>
    </>
  );
}
