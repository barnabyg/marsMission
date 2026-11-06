import type { Catalogue } from "../catalogue/catalogue";
import { crewShipOnMission } from "./crewAtMarsReport";
import { deliveryDayOf, type MissionOutcome } from "./flight";
import type { Rules } from "./rules";
import type { TurnPlan } from "./types";
import type { TurnSummary } from "./turnSummary";
import type {
  DecisionPointEntry,
  MissionAsset,
  Timeline,
  TimelineEntry,
} from "./timeline";

/** The Mission as Mission Mode displays it, or null if nothing launched. */
export function missionOnTimeline(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  flown: MissionOutcome,
): Timeline["mission"] {
  if (flown.vehicleName === null) return null;
  return {
    launchDay: 0,
    arrivalDay: rules.trajectoryFor(plan.mission).transferDays,
    launchVehicleName: flown.vehicleName,
    assetNames: [
      ...flown.assets.map((asset) => asset.name),
      ...(plan.mission?.crew ? [catalogue.crew.vehicleName] : []),
    ],
    assets: [
      ...flown.assets.map((asset): MissionAsset => {
        const delivered = flown.deliveredAssets.includes(asset);
        return {
          name: asset.name,
          kind: asset.kind,
          landingSiteName: asset.landsAtSite
            ? (flown.landingSite?.name ?? null)
            : null,
          deliveredOnDay: delivered
            ? deliveryDayOf(rules, plan, flown, asset)
            : null,
          lostOnDay: delivered ? null : flown.failedOnDay,
          crashed:
            !delivered &&
            asset.landsAtSite === true &&
            flown.failedEvent !== undefined &&
            asset.missionEvents.includes(flown.failedEvent.id),
        };
      }),
      ...crewShipOnMission(catalogue, rules, plan, flown),
    ],
    failedOnDay: flown.failedOnDay,
    ...(flown.solarParticleEvent
      ? { solarParticleEventDay: flown.solarParticleEvent.day }
      : {}),
    ...(flown.returned && flown.failedOnDay !== null
      ? {
          returnsToEarth: {
            fromDay: flown.failedOnDay,
            backOnDay: flown.returned.backOnDay,
          },
        }
      : {}),
  };
}

/**
 * What the Turn summary says about each Decision Point. It goes by how the Mission ended, so an Asset saved
 * and then lost to a later Mission Event isn't listed, and one saved twice shows the Service Life it ended with.
 */
export function contingenciesAnswered(
  flown: MissionOutcome,
): TurnSummary["contingencies"] {
  return flown.contingencies.map(({ saved, ...answered }) => ({
    ...answered,
    assets: saved
      .filter((asset) => flown.deliveredAssets.includes(asset))
      .map((asset) => ({
        name: asset.name,
        serviceLifeDays: flown.cutServiceLife.get(asset) ?? 0,
      })),
  }));
}

/** What the Turn summary says about a Mission that failed, or null if none did. */
export function missionFailure(flown: MissionOutcome): TurnSummary["failure"] {
  const name = flown.failedEvent?.name ?? flown.lostTo;
  return name !== null
    ? {
        missionEventName: name,
        ...(flown.lostTo === null ? {} : { hazard: true as const }),
        assetsLost: flown.assets
          .filter((asset) => !flown.deliveredAssets.includes(asset))
          .map((asset) => asset.name),
        publicSupportLost: flown.publicSupportLost,
        returnedToEarth: flown.returned !== null,
        refundMillions: flown.returned?.refundMillions ?? 0,
      }
    : null;
}

/** The Mission as it stands on a day, with nothing in it of what happens after that. */
function missionSoFar(
  mission: Timeline["mission"],
  day: number,
): Timeline["mission"] {
  if (!mission) return null;
  const { returnsToEarth, solarParticleEventDay, ...rest } = mission;
  const failedSoFar =
    mission.failedOnDay !== null && mission.failedOnDay <= day;
  return {
    ...rest,
    failedOnDay: failedSoFar ? mission.failedOnDay : null,
    ...(returnsToEarth && failedSoFar ? { returnsToEarth } : {}),
    ...(solarParticleEventDay !== undefined && solarParticleEventDay <= day
      ? { solarParticleEventDay }
      : {}),
    assets: mission.assets.map((asset) => {
      const lostSoFar = asset.lostOnDay !== null && asset.lostOnDay <= day;
      return {
        ...asset,
        deliveredOnDay:
          asset.deliveredOnDay !== null && asset.deliveredOnDay <= day
            ? asset.deliveredOnDay
            : null,
        lostOnDay: lostSoFar ? asset.lostOnDay : null,
        crashed: lostSoFar && asset.crashed,
      };
    }),
  };
}

/**
 * What Mission Mode plays up to a Decision Point: the Mission so far, and what else happens in the Turn before that
 * day, worked out as if the answer were the cautious one. The answer can still change one thing already shown: a
 * Funding Threshold's day depends on Public Support later in the Turn, so an answer can move it, and playback carries
 * on from there.
 */
export function timelineUpToDecision(
  asIfCautious: Timeline,
  otherEntries: readonly TimelineEntry[],
  missionEntries: readonly TimelineEntry[],
  mission: Timeline["mission"],
  { day, entry }: { day: number; entry: DecisionPointEntry | null },
): Timeline {
  return {
    ...asIfCautious,
    mission: missionSoFar(mission, day),
    decisionDay: day,
    dustStorms: asIfCautious.dustStorms.filter(({ fromDay }) => fromDay <= day),
    // The sort is stable, so the Mission's entries stay first on any day, as they do on a finished Turn's Timeline.
    entries: [
      ...missionEntries.filter((flown) => flown.day <= day),
      ...otherEntries.filter((other) => other.day < day),
      ...(entry ? [entry] : []),
    ].sort((first, second) => first.day - second.day),
  };
}
