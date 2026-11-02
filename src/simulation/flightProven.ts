import type { Catalogue } from "../catalogue/catalogue";
import { deliveryDayOf, type MissionOutcome } from "./flyMission";
import { formatMoney, type Rules } from "./rules";
import { isFlightProven, type Technology } from "./technologyReadiness";
import type { Program, TurnPlan } from "./types";
import type { FlightProvenEntry } from "./timeline";

/**
 * The technologies this Turn's Mission used successfully for the first time, which are Flight-proven from the next Turn
 * on: an Asset when it is delivered, and a Launch Vehicle when it gets past its own Mission Events.
 */
export function proveTechnologies(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: MissionOutcome,
): { technologies: Technology[]; entries: FlightProvenEntry[] } {
  const passed = new Map(
    flown.entries.flatMap((entry) =>
      entry.kind === "missionEvent" && entry.outcome === "success"
        ? [[entry.eventId, entry.day] as const]
        : [],
    ),
  );
  const vehicles = catalogue.launchVehicles.flatMap((vehicle) => {
    if (vehicle.id !== plan.mission?.launchVehicleId) return [];
    const days = vehicle.missionEvents.map((eventId) => passed.get(eventId));
    return days.every((day) => day !== undefined)
      ? [{ technology: vehicle, day: Math.max(0, ...days) }]
      : [];
  });
  const assets = flown.deliveredAssets.map((asset) => ({
    technology: asset,
    day: deliveryDayOf(rules, plan, flown, asset),
  }));
  const proven = [...vehicles, ...assets].filter(
    ({ technology }) => !isFlightProven(program, technology),
  );
  return {
    technologies: proven.map(({ technology }) => technology),
    entries: proven.map(({ technology, day }) => ({
      kind: "flightProven",
      day,
      title: `${technology.name} is Flight-proven`,
      description: `Its first successful flight. From the next Turn on, it costs ${formatMoney(technology.costMillions)} and fails less often.`,
    })),
  };
}
