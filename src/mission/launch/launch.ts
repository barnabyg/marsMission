import type { Timeline } from "../../simulation/simulation";
import { viewAskedForBy } from "../missionViews";
import { msSinceEntry, type PlaybackState } from "../playback";

/** Art dimensions in the pad's common coordinate system. Capacity is payload mass. */
const medium = { height: 8, radius: 0.52, boosters: 0, engines: 1 };
const heavy = { height: 10, radius: 0.67, boosters: 2, engines: 3 };
const colossus = { height: 12.4, radius: 0.92, boosters: 4, engines: 5 };

export function rocketProfile(vehicleId: string) {
  if (vehicleId === "meridian-colossus") return colossus;
  if (vehicleId === "meridian-heavy") return heavy;
  return medium;
}

export interface LaunchNow {
  vehicleId: string;
  elapsedMs: number;
  failed: boolean;
}

export function launchNow(
  { mission, entries }: Pick<Timeline, "mission" | "entries">,
  played: PlaybackState,
): LaunchNow | null {
  if (!mission) return null;
  const index = entries.findIndex(
    (entry) => entry.kind === "missionEvent" && entry.eventId === "launch",
  );
  const entry = entries[index];
  const elapsedMs = msSinceEntry(played, index);
  if (entry?.kind !== "missionEvent" || elapsedMs === null || elapsedMs >= 9000)
    return null;
  // Once another event has called the camera away, returning to the map cannot revisit liftoff.
  if (
    entries
      .slice(index + 1, played.entriesHappened)
      .some((later) => viewAskedForBy(later) !== null)
  )
    return null;
  return {
    vehicleId: mission.launchVehicleId,
    elapsedMs,
    failed: entry.outcome === "failure",
  };
}

/** Rise in pad units and seconds of separate flight since the stack broke up. */
export function launchMotion({ elapsedMs, failed }: LaunchNow) {
  const flying = Math.max(0, elapsedMs / 1000 - 2.3);
  const apart = failed ? Math.max(0, flying - 4.2) : 0;
  const climbing = flying - apart;
  return { rise: 0.85 * climbing ** 2 + 4.5 * apart - 2.3 * apart ** 2, apart };
}
