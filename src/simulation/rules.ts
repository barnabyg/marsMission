import type { Catalogue } from "../catalogue/catalogue";
import type { PlannedMission, Program } from "./types";

export type MissionEvent = Catalogue["missionEvents"][number];
export type ReliabilityLevel = Catalogue["reliabilityLevels"][number];
export type Asset = Catalogue["assets"][number];
export type LandingSite = Catalogue["landingSites"][number];
export type Activity = Catalogue["activities"][number];

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
 * A number from 0 up to 1 for one roll. It depends only on these three values, so changing anything
 * about another Mission Event or Asset can't change this roll. The hash is
 * FNV-1a followed by MurmurHash3's finaliser, which spreads out similar inputs such as adjacent seeds.
 */
export function roll(seed: number, turnNumber: number, key: string): number {
  let hash = 0x811c9dc5;
  for (const character of `${seed}:${turnNumber}:${key}`) {
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

/** How many days after the first date the second is. */
export function daysBetween(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    millisecondsPerDay
  );
}

/** How many days after `date` an Asset's Service Life ends, which is negative if it already has. */
export function daysUntilServiceEnds(
  date: string,
  asset: { arrivedOn: string; serviceLifeDays: number },
): number {
  return daysBetween(date, addDays(asset.arrivedOn, asset.serviceLifeDays));
}

/** How a plan names an Asset already operating. A Mission can't carry the same Asset twice, so no two share a key. */
export function operatingKey(asset: {
  assetId: string;
  arrivedOn: string;
}): string {
  return `${asset.assetId}:${asset.arrivedOn}`;
}

/** The calculations shared by planning a Mission and resolving a Turn. */
export function createRules(catalogue: Catalogue) {
  function dayOf({ timing }: MissionEvent): number {
    return timing.from === "launch"
      ? timing.days
      : catalogue.program.transferDays + timing.days;
  }

  function levelOrCheapest(chosenId: string | undefined): ReliabilityLevel {
    const { reliabilityLevels } = catalogue;
    const level =
      reliabilityLevels.find(({ id }) => id === chosenId) ??
      reliabilityLevels[0];
    // The Catalogue guarantees at least one level.
    if (!level) throw new Error("The catalogue has no Reliability levels");
    return level;
  }

  /** The level a Mission has bought for a Mission Event, which is the cheapest unless it chose another. */
  function reliabilityLevelFor(
    mission: PlannedMission | null,
    eventId: string,
  ): ReliabilityLevel {
    return levelOrCheapest(mission?.reliability?.[eventId]);
  }

  /** The Service Life a Mission has chosen for an Asset, which is the shortest unless it chose another. */
  function serviceLifeFor(mission: PlannedMission | null, asset: Asset) {
    const chosen = mission?.assetChoices?.[asset.id]?.serviceLifeDays;
    const option =
      asset.serviceLifeOptions.find(({ days }) => days === chosen) ??
      asset.serviceLifeOptions[0];
    // The Catalogue guarantees at least one option.
    if (!option) throw new Error(`"${asset.id}" has no Service Life options`);
    return option;
  }

  /** The level bought for an Asset, which is the cheapest unless the Mission chose another. */
  function assetReliabilityFor(
    mission: PlannedMission | null,
    asset: Asset,
  ): ReliabilityLevel {
    return levelOrCheapest(
      mission?.assetChoices?.[asset.id]?.reliabilityLevelId,
    );
  }

  function activityById(id: string): Activity | undefined {
    return catalogue.activities.find((activity) => activity.id === id);
  }

  /** The Activities an Asset can do, in the order it lists them. */
  function activitiesOf(asset: Asset): Activity[] {
    return asset.activities.flatMap((id) => activityById(id) ?? []);
  }

  /** The Activity a Mission has chosen for an Asset, which is the first it lists unless it chose another. */
  function activityFor(mission: PlannedMission | null, asset: Asset): Activity {
    const chosen = mission?.assetChoices?.[asset.id]?.activityId;
    const available = activitiesOf(asset);
    const activity = available.find(({ id }) => id === chosen) ?? available[0];
    // The Catalogue guarantees at least one, and that each one exists.
    if (!activity) throw new Error(`"${asset.id}" has no Activities`);
    return activity;
  }

  /** An operating Asset's Activity as the player reads it. If a save holds one that has left the catalogue, the Asset does nothing. */
  function activityNameOf(asset: { activityId: string }): string {
    return activityById(asset.activityId)?.name ?? "Nothing";
  }

  /** How an operating Asset gets about on the surface, which only research sets. */
  function surfaceMotionOf(asset: {
    activityId: string;
  }): "traverse" | "nearby" | "still" {
    const effect = activityById(asset.activityId)?.effect;
    return effect?.kind === "research" ? effect.surfaceMotion : "still";
  }

  /** The one calculation behind both an Asset's roll in service and the risk band Planning Mode shows. */
  function inServiceFailureChance(
    asset: Asset,
    level: ReliabilityLevel,
  ): number {
    return asset.failureChancePerTurn * level.failureMultiplier;
  }

  /** The Landing Sites that can be chosen so far. */
  function knownLandingSites(program: Program): LandingSite[] {
    return program.knownLandingSiteIds.flatMap((id) =>
      catalogue.landingSites.filter((site) => site.id === id),
    );
  }

  /** A site's landing risk for this Program, which a Survey lowers. */
  function landingRisk(program: Program, site: LandingSite): number {
    return program.surveyedLandingSiteIds.includes(site.id)
      ? site.surveyedLandingRisk
      : site.landingRisk;
  }

  function landingSiteById(id: string | null | undefined) {
    return catalogue.landingSites.find((site) => site.id === id);
  }

  /** The one calculation behind both a Mission Event's roll and the risk band Planning Mode shows. */
  function failureProbability(
    event: MissionEvent,
    level: ReliabilityLevel,
    program: Program,
    mission: PlannedMission | null,
  ): number {
    if (event.failureProbability !== "landingSite") {
      return event.failureProbability * level.failureMultiplier;
    }
    const site = landingSiteById(mission?.landingSiteId);
    // Planning Mode always names a site. A plan that doesn't is refused, so this 1 is never rolled.
    return (site ? landingRisk(program, site) : 1) * level.failureMultiplier;
  }

  /** The day an Asset is delivered, which is when its last Mission Event happens. */
  function deliveryDay(asset: Asset): number {
    const days = asset.missionEvents.flatMap((eventId) =>
      catalogue.missionEvents
        .filter((event) => event.id === eventId)
        .map(dayOf),
    );
    return Math.max(catalogue.program.transferDays, ...days);
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
    deliveryDay,
    serviceLifeFor,
    assetReliabilityFor,
    activityById,
    activitiesOf,
    activityFor,
    activityNameOf,
    surfaceMotionOf,
    inServiceFailureChance,
    knownLandingSites,
    landingRisk,
    landingSiteById,
    reliabilityLevelFor,
    failureProbability,
    riskBandFor,
    missionEventsFor,
  };
}

export type Rules = ReturnType<typeof createRules>;
