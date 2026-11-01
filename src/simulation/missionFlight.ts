import type { Catalogue } from "../catalogue/catalogue";
import {
  roll,
  type Asset,
  type LandingSite,
  type MissionEvent,
  type Rules,
} from "./rules";
import type {
  MissionAsset,
  MissionEventEntry,
  Program,
  Timeline,
  TurnPlan,
  TurnSummary,
} from "./types";

/** What happened to the Turn's Mission, if there was one. */
export interface MissionOutcome {
  vehicleName: string | null;
  assets: Asset[];
  /** The Mission Events that happened, ending with the one that failed if one did. */
  entries: MissionEventEntry[];
  failedEvent: MissionEvent | undefined;
  /** The day of the failed Mission Event, if there was one. */
  failedOnDay: number | null;
  deliveredAssets: Asset[];
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
}

/** What is landing, to start a sentence, such as "The rover". Always in the Catalogue's order, whatever order the Mission lists them. */
function whatLands(catalogue: Catalogue, assets: Asset[]): string {
  const kinds = catalogue.assets
    .filter((asset) => asset.landsAtSite && assets.includes(asset))
    .map(({ kind }) => `the ${kind}`);
  const named = new Intl.ListFormat("en").format(new Set(kinds));
  return named.charAt(0).toUpperCase() + named.slice(1);
}

/** Rolls each of the Mission's Mission Events in turn, up to the first that fails. */
export function flyMission(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): MissionOutcome {
  const { mission } = plan;
  const vehicle = catalogue.launchVehicles.find(
    (candidate) => candidate.id === mission?.launchVehicleId,
  );
  const assets = (mission?.assetIds ?? []).flatMap((assetId) =>
    catalogue.assets.filter((candidate) => candidate.id === assetId),
  );
  const landingSite = rules.landingSiteById(mission?.landingSiteId);
  const filledIn = (text: string) =>
    text
      .replaceAll("{site}", landingSite?.name ?? "")
      .replaceAll("{lander}", whatLands(catalogue, assets));
  const plannedEvents = mission
    ? rules.missionEventsFor(mission.launchVehicleId, mission.assetIds)
    : [];
  const failedIndex = plannedEvents.findIndex(
    (event) =>
      roll(program.seed, program.turnNumber, event.id) <
      rules.failureProbability(
        event,
        rules.reliabilityLevelFor(mission, event.id),
        program,
        mission,
      ),
  );
  const failedEvent = plannedEvents[failedIndex];
  // An Asset is delivered when its last Mission Event succeeds, so anything delivered before a failure is safe.
  const deliveredAssets = failedEvent
    ? assets.filter(
        (asset) => rules.deliveryDay(asset) < rules.dayOf(failedEvent),
      )
    : assets;
  const lostNames = assets
    .filter((asset) => !deliveredAssets.includes(asset))
    .map((asset) => asset.name);
  const safe =
    deliveredAssets.length > 0
      ? ` Still safe: ${deliveredAssets.map((asset) => asset.name).join(", ")}.`
      : "";
  const publicSupportLost = failedEvent
    ? Math.min(failedEvent.publicSupportLoss, program.publicSupport)
    : 0;

  const entries = plannedEvents
    .slice(0, failedEvent ? failedIndex + 1 : undefined)
    .map((event): MissionEventEntry =>
      event === failedEvent
        ? {
            kind: "missionEvent",
            day: rules.dayOf(event),
            eventId: event.id,
            title: `${event.name} failed`,
            description: `${filledIn(event.failureDescription)} Lost with the Mission: ${lostNames.join(", ")}.${safe} It costs ${publicSupportLost} Public Support.`,
            outcome: "failure",
          }
        : {
            kind: "missionEvent",
            day: rules.dayOf(event),
            eventId: event.id,
            title: event.name,
            description: filledIn(event.description),
            outcome: "success",
          },
    );

  return {
    vehicleName: vehicle?.name ?? null,
    assets,
    entries,
    failedEvent,
    failedOnDay: failedEvent ? rules.dayOf(failedEvent) : null,
    deliveredAssets,
    publicSupportLost,
    landingSite,
  };
}

/** The Mission as Mission Mode displays it, or null if nothing launched. */
export function missionOnTimeline(
  catalogue: Catalogue,
  rules: Rules,
  flown: MissionOutcome,
): Timeline["mission"] {
  if (flown.vehicleName === null) return null;
  return {
    launchDay: 0,
    arrivalDay: catalogue.program.transferDays,
    launchVehicleName: flown.vehicleName,
    assetNames: flown.assets.map((asset) => asset.name),
    assets: flown.assets.map((asset): MissionAsset => {
      const delivered = flown.deliveredAssets.includes(asset);
      return {
        name: asset.name,
        kind: asset.kind,
        landingSiteName: asset.landsAtSite
          ? (flown.landingSite?.name ?? null)
          : null,
        deliveredOnDay: delivered ? rules.deliveryDay(asset) : null,
        lostOnDay: delivered ? null : flown.failedOnDay,
        crashed:
          !delivered &&
          asset.landsAtSite === true &&
          flown.failedEvent !== undefined &&
          asset.missionEvents.includes(flown.failedEvent.id),
      };
    }),
    failedOnDay: flown.failedOnDay,
  };
}

/** What the Turn summary says about a Mission that failed, or null if none did. */
export function missionFailure(flown: MissionOutcome): TurnSummary["failure"] {
  return flown.failedEvent
    ? {
        missionEventName: flown.failedEvent.name,
        assetsLost: flown.assets
          .filter((asset) => !flown.deliveredAssets.includes(asset))
          .map((asset) => asset.name),
        publicSupportLost: flown.publicSupportLost,
      }
    : null;
}
