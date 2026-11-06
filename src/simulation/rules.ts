import type { Catalogue } from "../catalogue/catalogue";
import type { PlannedMission, Program } from "./types";
import { isLandingSiteKey } from "./crewPlaces";
import { technologiesOn, unprovenMultiplier } from "./technologyReadiness";
import type { SurfaceMotion } from "./timeline";

export type MissionEvent = Catalogue["missionEvents"][number];
export type ReliabilityLevel = Catalogue["reliabilityLevels"][number];
export type Asset = Catalogue["assets"][number];
export type LandingSite = Catalogue["landingSites"][number];
export type Activity = Catalogue["activities"][number];
export type Contingency = Catalogue["contingencies"][number];
export type Trajectory = Catalogue["trajectories"][number];

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
  /** The Trajectory a Mission flies, which is the first listed unless it chose another. */
  function trajectoryFor(mission: PlannedMission | null): Trajectory {
    const { trajectories } = catalogue;
    const trajectory =
      trajectories.find(({ id }) => id === mission?.trajectoryId) ??
      trajectories[0];
    // The Catalogue guarantees at least one.
    if (!trajectory) throw new Error("The catalogue has no Trajectories");
    return trajectory;
  }

  /**
   * The Mission Events that carry a Mission's Crew, if it has Crew: to Mars orbit, or to its Landing Site if they land.
   * Like an Asset's, they deliver the Crew when the last of them succeeds.
   */
  function crewOf(mission: PlannedMission | null): { missionEvents: string[] } {
    const { crew } = catalogue;
    if (!mission?.crew) return { missionEvents: [] };
    return {
      missionEvents: mission.crew.landsAtSite
        ? crew.landingMissionEvents
        : crew.missionEvents,
    };
  }

  /** The Mission Events a Mission goes through, in the order the Catalogue lists them, with its Crew's if it has Crew. */
  function eventsOf(mission: PlannedMission | null): MissionEvent[] {
    const eventIds = new Set([
      ...technologiesOn(catalogue, mission).flatMap(
        ({ missionEvents }) => missionEvents,
      ),
      ...crewOf(mission).missionEvents,
      ...(mission?.returnVehicle
        ? catalogue.crew.returnVehicle.missionEvents
        : []),
    ]);
    return [...eventIds].flatMap((eventId) =>
      catalogue.missionEvents.filter((event) => event.id === eventId),
    );
  }

  // Kept for each Mission, because balance runs ask for the day of every Mission Event many times over. Plans are
  // never changed in place, so a Mission's departure never changes.
  const departureDays = new WeakMap<PlannedMission, number>();

  /** The day a Mission leaves Earth orbit for Mars: the day after the last of its Mission Events timed from launch. */
  function departureDay(mission: PlannedMission | null): number {
    const known = mission ? departureDays.get(mission) : undefined;
    if (known !== undefined) return known;
    const day =
      1 +
      Math.max(
        0,
        ...eventsOf(mission).flatMap(({ timing }) =>
          timing.from === "launch" ? [timing.days] : [],
        ),
      );
    if (mission) departureDays.set(mission, day);
    return day;
  }

  /**
   * The day of the Turn a Mission Event happens to this Mission. One timed from leaving Mars counts from `leavesMarsOn`,
   * the day of the Turn a journey home sets off, and has no day in a Turn without one.
   */
  function dayOf(
    { id, timing }: MissionEvent,
    mission: PlannedMission | null,
    leavesMarsOn: number | null = null,
  ): number {
    switch (timing.from) {
      case "launch":
        return timing.days;
      case "departure":
        return departureDay(mission) + timing.days;
      case "arrival":
        return trajectoryFor(mission).transferDays + timing.days;
      case "leavingMars":
        if (leavesMarsOn === null) {
          throw new Error(
            `The Mission Event "${id}" is timed from leaving Mars, but nothing leaves Mars this Turn`,
          );
        }
        return leavesMarsOn + timing.days;
    }
  }

  /** Whether a Mission can fly this Trajectory, which a Free-return only allows if it has the burn it's for. */
  function trajectoryOffered(
    { freeReturn }: Trajectory,
    mission: PlannedMission,
  ): boolean {
    return (
      freeReturn === undefined ||
      missionEventsFor(mission).some(({ id }) => id === freeReturn.arrivalBurn)
    );
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

  /** The Contingency a Mission has bought for a Mission Event, if it has. */
  function contingencyFor(
    mission: PlannedMission | null,
    eventId: string,
  ): Contingency | undefined {
    return catalogue.contingencies.find(
      ({ id, missionEvent }) =>
        missionEvent === eventId && mission?.contingencyIds?.includes(id),
    );
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

  /** The Catalogue's first Activity of doing nothing. */
  function nothingActivity(): Activity {
    const activity = catalogue.activities.find(
      ({ effect }) => effect.kind === "nothing",
    );
    // The Catalogue guarantees at least one.
    if (!activity) throw new Error("The Catalogue has no nothing Activity");
    return activity;
  }

  /** An operating Asset's Activity as the player reads it. If a save holds one that has left the catalogue, the Asset does nothing. */
  function activityNameOf(asset: { activityId: string }): string {
    return (activityById(asset.activityId) ?? nothingActivity()).name;
  }

  /** How an operating Asset gets about on the surface, which only research and Sample caching set. */
  function surfaceMotionOf(asset: { activityId: string }): SurfaceMotion {
    const effect = activityById(asset.activityId)?.effect;
    return effect?.kind === "research" || effect?.kind === "sampleCaching"
      ? effect.surfaceMotion
      : "still";
  }

  /** The one calculation behind both an Asset's roll in service and the risk band Planning Mode shows. */
  function inServiceFailureChance(
    asset: Asset,
    level: ReliabilityLevel,
    flewUnproven: boolean,
  ): number {
    const unproven = flewUnproven
      ? (asset.unproven?.failureMultiplier ?? 1)
      : 1;
    return Math.min(
      1,
      asset.failureChancePerTurn * unproven * level.failureMultiplier,
    );
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

  /**
   * What a landing's risk is multiplied by for what it lands, which is as risky as the riskiest Asset in it. Crew land
   * at the site's own risk.
   */
  function landingRiskMultiplierOf(mission: PlannedMission | null): number {
    return Math.max(
      mission?.crew?.landsAtSite ? 1 : 0,
      ...catalogue.assets
        .filter(
          ({ id, landsAtSite }) =>
            landsAtSite === true && mission?.assetIds.includes(id),
        )
        .map(({ landingRiskMultiplier }) => landingRiskMultiplier ?? 1),
      // A Mission with nothing that lands has no landing to multiply.
      0,
    );
  }

  /**
   * The one calculation behind both a Mission Event's roll and the risk band Planning Mode shows. An unproven
   * technology raises the Mission Events it brings, and the most unproven of those on board sets how much.
   */
  function failureProbability(
    event: MissionEvent,
    level: ReliabilityLevel,
    program: Program,
    mission: PlannedMission | null,
  ): number {
    const unproven = Math.max(
      1,
      ...technologiesOn(catalogue, mission)
        .filter(({ missionEvents }) => missionEvents.includes(event.id))
        .map((technology) => unprovenMultiplier(program, technology)),
    );
    if (event.failureProbability !== "landingSite") {
      return Math.min(
        1,
        event.failureProbability * unproven * level.failureMultiplier,
      );
    }
    const site = landingSiteById(mission?.landingSiteId);
    // Planning Mode always names a site. A plan that doesn't is refused, so this 1 is never rolled.
    const risk = site
      ? landingRisk(program, site) * landingRiskMultiplierOf(mission)
      : 1;
    return Math.min(1, risk * unproven * level.failureMultiplier);
  }

  /** The day this Mission delivers an Asset, or its Crew, which is when its last Mission Event happens. */
  function deliveryDay(
    { missionEvents }: { missionEvents: string[] },
    mission: PlannedMission | null,
  ): number {
    const days = missionEvents.flatMap((eventId) =>
      catalogue.missionEvents
        .filter((event) => event.id === eventId)
        .map((event) => dayOf(event, mission)),
    );
    return Math.max(trajectoryFor(mission).transferDays, ...days);
  }

  function riskBandFor(probability: number): string {
    const band = catalogue.riskBands.find(({ upTo }) => probability <= upTo);
    // The Catalogue guarantees the last band goes up to 1.
    if (!band) throw new Error(`No risk band covers ${probability}`);
    return band.label;
  }

  /** The Mission Events a Mission goes through, in the order they happen. */
  function missionEventsFor(mission: PlannedMission): MissionEvent[] {
    return eventsOf(mission).sort(
      (first, second) => dayOf(first, mission) - dayOf(second, mission),
    );
  }

  /**
   * The Mission Events of a round trip's journey home, in the order they happen after leaving Mars, with Mars ascent and
   * the rendezvous first for Crew leaving a Landing Site. The sort is stable, so those on the same day keep their order.
   */
  function journeyHomeEvents(fromSurface = false): MissionEvent[] {
    const { roundTrip } = catalogue.crew;
    return [
      ...(fromSurface ? roundTrip.ascent.missionEvents : []),
      ...roundTrip.missionEvents,
    ]
      .flatMap((eventId) =>
        catalogue.missionEvents.filter((event) => event.id === eventId),
      )
      .sort((first, second) => first.timing.days - second.timing.days);
  }

  /**
   * The Mission Events of the journey home on a later Turn that a Mission buys Reliability and Contingency for: its own
   * Crew's on a round trip, or those of the Crew its return vehicle fetches, through Mars ascent if they are at a
   * Landing Site. A Mission with neither has none.
   */
  function homewardEventsFor(mission: PlannedMission | null): MissionEvent[] {
    if (mission?.crew?.roundTrip) {
      return journeyHomeEvents(mission.crew.landsAtSite === true);
    }
    return mission?.returnVehicle
      ? journeyHomeEvents(isLandingSiteKey(mission.returnVehicle.forCrewAt))
      : [];
  }

  return {
    crewOf,
    trajectoryFor,
    trajectoryOffered,
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
    contingencyFor,
    failureProbability,
    riskBandFor,
    missionEventsFor,
    journeyHomeEvents,
    homewardEventsFor,
  };
}

export type Rules = ReturnType<typeof createRules>;
