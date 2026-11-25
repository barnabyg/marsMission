import type { Homeward, HomewardNow } from "../homeward";
import type { Point } from "../sceneParts";

export interface DepartureNow {
  stage: "ignition" | "departing" | "stranded";
  crewed: boolean;
  vehicleName: string;
  sinceMs: number;
  place: Point;
  flame: number;
}

export const departureCutoffMs = 1800;

/** The engine lights briefly on both outcomes. A failed vehicle coasts above Mars after cutoff. */
export function departureNow(
  homeward: Pick<Homeward, "aboard" | "vehicleName"> | null,
  inSpace: HomewardNow | null,
): DepartureNow | null {
  if (!homeward || inSpace?.part !== "departure") return null;
  const { sinceMs, failed } = inSpace;
  const seconds = Math.max(sinceMs - departureCutoffMs, 0) / 1000;
  const stage =
    sinceMs < departureCutoffMs
      ? "ignition"
      : failed
        ? "stranded"
        : "departing";
  const drift = failed ? 0.06 * seconds : 0.3 * seconds * seconds;
  return {
    stage,
    crewed: homeward.aboard === "crew",
    vehicleName: homeward.vehicleName,
    sinceMs,
    place: [-0.6 + drift, 0.12 * drift, -0.4 * drift],
    flame:
      stage === "stranded"
        ? 0
        : Math.min(1, Math.max(0, (sinceMs - 600) / 450)),
  };
}

export function departureStatus(now: DepartureNow | null): string | null {
  if (!now) return null;
  const aboard = now.crewed ? "the Crew" : "the samples";
  switch (now.stage) {
    case "ignition":
      return `Trans-Earth injection: the ${now.vehicleName} fires its engine above Mars`;
    case "departing":
      return `Trans-Earth injection: the ${now.vehicleName} carries ${aboard} out of Mars orbit`;
    case "stranded":
      return `Trans-Earth injection failed: the engine cut out, leaving ${aboard} in Mars orbit`;
  }
}
