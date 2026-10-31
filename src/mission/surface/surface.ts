import type { AssetAtMars, Timeline } from "../../simulation/simulation";
import { assetsAtMarsOn } from "../journey";
import type { CameraPose, Point } from "../sceneParts";
import { roverSpot, type RoverAtWork, type RoverSpot } from "./motion";

/**
 * A patch of ground of its own, with its own sky, behind both other views' cameras. Everything is
 * unlit with its light worked into its colours, because a light here would fall on the other views too.
 */
export const surfaceCentre: Point = [0, 0, 20];

/** Looks away from the other views, so that they cost nothing to draw from here. */
export const surfaceShot: CameraPose = {
  position: [0, 2.2, 12.5],
  target: [0, 0.75, 20],
};

/** Further back and looking level, with room above the ground for what's coming down. */
export const landingShot: CameraPose = {
  position: [0, 2.3, 11.6],
  target: [0, 2.3, 20],
};

type Mission = Pick<NonNullable<Timeline["mission"]>, "assets">;

export type SurfaceModel = "lander" | "rover";

/** Everything else that lands stands still until it has a model of its own. */
export function modelOf(kind: string): SurfaceModel {
  return kind === "rover" ? "rover" : "lander";
}

interface SurfaceAsset extends RoverAtWork {
  name: string;
  kind: string;
  model: SurfaceModel;
  activityName: string;
  /** Its place among the Turn's Assets at this Landing Site, which stays the same all Turn. */
  place: number;
}

/** The Assets operating at a Landing Site on a given day. A crash never starts operating, so it is never here. */
export function surfaceAssetsAt(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
  siteName: string,
): SurfaceAsset[] {
  const atSite = timeline.assetsAtMars.filter(
    ({ landingSiteName }) => landingSiteName === siteName,
  );
  return assetsAtMarsOn({ assetsAtMars: atSite }, day).map((asset) => ({
    surfaceMotion: asset.surfaceMotion,
    key: asset.key,
    arrivedOnDay: asset.arrivedOnDay,
    fromDay: asset.fromDay,
    untilDay: asset.untilDay,
    name: asset.name,
    kind: asset.kind,
    model: modelOf(asset.kind),
    activityName: asset.activityName,
    place: atSite.indexOf(asset),
  }));
}

/** Where a place is on the ground, relative to the middle of the shot. Places alternate left and right, the later ones further from the camera. */
export function placeOf(place: number): { x: number; z: number } {
  const side = place % 2 === 0 ? -1 : 1;
  const row = Math.floor(place / 2);
  return { x: side * (1.5 + row * 1.8), z: row * 2 };
}

/** Where an Asset is on the ground on a given day. Only a rover goes anywhere. */
export function spotOf(asset: SurfaceAsset, day: number): RoverSpot {
  const anchor = placeOf(asset.place);
  return asset.model === "rover"
    ? roverSpot(asset, anchor, day)
    : { ...anchor, heading: 0 };
}

/** The Assets of this Turn's Mission still coming down to a Landing Site on a given day. */
export function landingsOnTheirWay(
  mission: Mission | null,
  day: number,
): { name: string; siteName: string }[] {
  return (mission?.assets ?? []).flatMap((asset) => {
    const { name, landingSiteName, deliveredOnDay, lostOnDay } = asset;
    const stillComing =
      (deliveredOnDay === null || day < deliveredOnDay) &&
      (lostOnDay === null || day < lostOnDay);
    return landingSiteName !== null && stillComing
      ? [{ name, siteName: landingSiteName }]
      : [];
  });
}

function onTheSurface(asset: AssetAtMars): asset is AssetAtMars & {
  landingSiteName: string;
} {
  return asset.landingSiteName !== null;
}

/**
 * The Landing Sites there are to show on a given day, and so to choose between. The first is the
 * site of the latest landing, which is the one where the Asset that arrived last is still
 * operating, this Turn's Mission included from the day it is delivered. After them comes the
 * destination of a landing on its way. An empty list means the surface view has nothing to show.
 */
export function sitesToShow(
  timeline: Pick<Timeline, "assetsAtMars" | "mission">,
  day: number,
): string[] {
  const landedSites = assetsAtMarsOn(timeline, day)
    .filter(onTheSurface)
    .sort((first, second) => second.arrivedOnDay - first.arrivedOnDay)
    .map(({ landingSiteName }) => landingSiteName);
  const destinations = landingsOnTheirWay(timeline.mission, day).map(
    ({ siteName }) => siteName,
  );
  return [...new Set([...landedSites, ...destinations])];
}

/** The player's pick for as long as there's anything to show there, or else the latest landing. */
export function siteShown(
  sites: readonly string[],
  picked: string | null,
): string | null {
  return picked !== null && sites.includes(picked)
    ? picked
    : (sites[0] ?? null);
}

/** What the player reads about a Landing Site on a given day, one line each. */
export function describeSite(
  timeline: Pick<Timeline, "assetsAtMars" | "mission">,
  day: number,
  siteName: string,
): string[] {
  const here = surfaceAssetsAt(timeline, day, siteName).map(
    ({ name, kind, activityName }) => `${name} (${kind}): ${activityName}`,
  );
  const coming = landingsOnTheirWay(timeline.mission, day)
    .filter((landing) => landing.siteName === siteName)
    .map(({ name }) => name);
  const crashedHere = timeline.mission?.assets.some(
    ({ crashed, landingSiteName, lostOnDay }) =>
      crashed &&
      landingSiteName === siteName &&
      lostOnDay !== null &&
      day >= lostOnDay,
  );
  const nothing = crashedHere ? "Nothing operating here" : "Nothing here yet";
  return [
    ...(here.length > 0 ? here : [nothing]),
    ...(coming.length > 0 ? [`On its way: ${coming.join(", ")}`] : []),
  ];
}
