import type { Timeline } from "../../simulation/simulation";
import { GameText } from "../../ui/GameText";
import type { MissionViewId } from "../missionViews";
import { marsRendezvousStatus, type MarsRendezvousNow } from "./marsRendezvous";
import { burnStatus, type TransferBurn } from "./transferBurn";
import { earthOrbitStatus, type EarthOrbitNow } from "./refuelling";
import { departureStatus, type DepartureNow } from "./transEarthInjection";
import { earthEntryStatus, type EarthEntryNow } from "./splashdown";
import { assetsOnBoard } from "./spacecraft";

/** Why the spacecraft view's button is disabled, which the button itself tells the player. */
export const spacecraftUnavailableReason =
  "Spacecraft view: no Mission is in flight.";

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
  burn: TransferBurn | null;
  /** The rendezvous in Mars orbit on the way home, while it plays. */
  marsRendezvous: MarsRendezvousNow | null;
  /** Earth entry at the end of the way home, while it plays. */
  earthEntry: EarthEntryNow | null;
  departure: DepartureNow | null;
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
  burn: TransferBurn | null,
): string[] {
  if (earthOrbit || burn) {
    const consequence =
      earthOrbit?.stage === "tankerLost"
        ? ": stranded in Earth orbit"
        : earthOrbit?.missionLost
          ? ": lost in Earth orbit"
          : burn?.stage === "cutoff"
            ? ": lost on the way"
            : "";
    return (timeline.mission?.assets ?? []).map(
      ({ name, kind }) => `${name} (${kindName(kind)})${consequence}`,
    );
  }
  return assetsOnBoard(timeline.mission, day).map(({ name, kind, lost }) =>
    lost
      ? `${name} (${kindName(kind)}): lost on the way`
      : `${name} (${kindName(kind)})`,
  );
}

/** What's on board and what's happening to it, while the spacecraft view is showing. */
export function SpacecraftControls({
  timeline,
  day,
  view,
  available,
  particles,
  earthOrbit,
  burn,
  marsRendezvous,
  earthEntry,
  departure,
}: SpacecraftControlsProps) {
  if (!available || view !== "spacecraft") return null;
  // The way home, close up, shows nothing else.
  const homeward =
    marsRendezvousStatus(marsRendezvous) ??
    departureStatus(departure) ??
    earthEntryStatus(earthEntry);
  if (homeward !== null) {
    return (
      <>
        <h2>On board</h2>
        <ul data-testid="spacecraft-status">
          <li>
            <GameText>{homeward}</GameText>
          </li>
        </ul>
      </>
    );
  }
  return (
    <>
      <h2>On board</h2>
      <ul data-testid="spacecraft-status">
        {[
          ...(particles
            ? ["Solar particle event: radiation sweeping past"]
            : []),
          ...[
            (burn ? burnStatus[burn.stage] : earthOrbitStatus(earthOrbit)) ??
              [],
          ].flat(),
          ...onBoardLines(timeline, day, earthOrbit, burn),
        ].map((line) => (
          <li key={line}>
            <GameText>{line}</GameText>
          </li>
        ))}
      </ul>
    </>
  );
}
