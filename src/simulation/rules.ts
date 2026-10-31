import type { Catalogue } from "../catalogue/catalogue";
import type { PlannedMission } from "./types";

export type MissionEvent = Catalogue["missionEvents"][number];
export type ReliabilityLevel = Catalogue["reliabilityLevels"][number];

const millisecondsPerDay = 86_400_000;

export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * millisecondsPerDay;
  return new Date(time).toISOString().slice(0, 10);
}

export function formatMoney(millions: number): string {
  const sign = millions < 0 ? "-" : "";
  const size = Math.abs(millions);
  if (size >= 1000) return `${sign}$${String(size / 1000)}B`;
  return `${sign}$${String(size)}M`;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * A number from 0 up to 1 for one Mission Event's failure roll. It depends only on these three
 * values, so changing anything about another Mission Event can't change this roll. The hash is
 * FNV-1a followed by MurmurHash3's finaliser, which spreads out similar inputs such as adjacent seeds.
 */
export function missionEventRoll(
  seed: number,
  turnNumber: number,
  eventId: string,
): number {
  let hash = 0x811c9dc5;
  for (const character of `${seed}:${turnNumber}:${eventId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 2 ** 32;
}

/** The calculations shared by planning a Mission and resolving a Turn. */
export function createRules(catalogue: Catalogue) {
  function dayOf({ timing }: MissionEvent): number {
    return timing.from === "launch"
      ? timing.days
      : catalogue.program.transferDays + timing.days;
  }

  /** The level a Mission has bought for a Mission Event, which is the cheapest unless it chose another. */
  function reliabilityLevelFor(
    mission: PlannedMission | null,
    eventId: string,
  ): ReliabilityLevel {
    const { reliabilityLevels } = catalogue;
    const chosenId = mission?.reliability?.[eventId];
    const level =
      reliabilityLevels.find(({ id }) => id === chosenId) ??
      reliabilityLevels[0];
    // The Catalogue guarantees at least one level.
    if (!level) throw new Error("The catalogue has no Reliability levels");
    return level;
  }

  /** The one calculation behind both a Mission Event's roll and the risk band Planning Mode shows. */
  function failureProbability(
    event: MissionEvent,
    level: ReliabilityLevel,
  ): number {
    return event.failureProbability * level.failureMultiplier;
  }

  function riskBandFor(probability: number): string {
    const band = catalogue.riskBands.find(({ upTo }) => probability <= upTo);
    // The Catalogue guarantees the last band goes up to 1.
    if (!band) throw new Error(`No risk band covers ${probability}`);
    return band.label;
  }

  /** The Mission Events a Mission goes through, in the order they happen. */
  function missionEventsFor(
    launchVehicleId: string,
    assetIds: string[],
  ): MissionEvent[] {
    const vehicle = catalogue.launchVehicles.find(
      (candidate) => candidate.id === launchVehicleId,
    );
    const assets = catalogue.assets.filter((asset) =>
      assetIds.includes(asset.id),
    );
    const eventIds = new Set([
      ...(vehicle?.missionEvents ?? []),
      ...assets.flatMap((asset) => asset.missionEvents),
    ]);
    return [...eventIds]
      .flatMap((eventId) =>
        catalogue.missionEvents.filter((event) => event.id === eventId),
      )
      .sort((first, second) => dayOf(first) - dayOf(second));
  }

  return {
    dayOf,
    reliabilityLevelFor,
    failureProbability,
    riskBandFor,
    missionEventsFor,
  };
}

export type Rules = ReturnType<typeof createRules>;
