import type {
  AssetAtMars,
  CrewMemberAtMarsOnTimeline as CrewMember,
  Timeline,
} from "../../simulation/simulation";
import { activityAndCut, assetsAtMarsOn } from "../journey";
import type { CameraPose, Point } from "../sceneParts";
import {
  roverSpot,
  traversePaths,
  type RoverAtWork,
  type RoverSpot,
} from "./motion";

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

export type SurfaceModel =
  | "lander"
  | "rover"
  | "crewLander"
  | "fuelPlant"
  | "habitat"
  | "lab"
  | "ascentVehicle";

/** The model of each kind of Asset that lands and has one of its own. The Crew come down in a lander of their own. */
const surfaceModels: Partial<Record<string, SurfaceModel>> = {
  rover: "rover",
  crew: "crewLander",
  "fuel-plant": "fuelPlant",
  habitat: "habitat",
  lab: "lab",
  "ascent-vehicle": "ascentVehicle",
};

/** Anything else that lands stands still as a lander does, until it has a model of its own. */
export function modelOf(kind: string): SurfaceModel {
  return surfaceModels[kind] ?? "lander";
}

export interface SurfaceAsset extends RoverAtWork {
  name: string;
  kind: string;
  model: SurfaceModel;
  activityName: string;
  /** The Service Life it was cut to by a Contingency used this Turn, if it was. */
  cutServiceLifeDays?: number;
  /** Its place among the Turn's Assets at this Landing Site, which stays the same all Turn. */
  place: number;
  /** For the Crew's ship, every Crew member at the site during the Turn. */
  crew: readonly CrewMember[];
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
    // As the screen names it, numbered when several of its kind are at Mars.
    name: asset.label,
    kind: asset.kind,
    model: modelOf(asset.kind),
    activityName: asset.activityName,
    ...(asset.cutServiceLifeDays === undefined
      ? {}
      : { cutServiceLifeDays: asset.cutServiceLifeDays }),
    place: atSite.indexOf(asset),
    crew: asset.crew ?? [],
  }));
}

/** Where a place is on the ground, relative to the middle of the shot. Places alternate left and right, the later ones further from the camera. */
export function placeOf(place: number): { x: number; z: number } {
  const side = place % 2 === 0 ? -1 : 1;
  const row = Math.floor(place / 2);
  return { x: side * (1.5 + row * 1.8), z: row * 2 };
}

/**
 * How many places, from the first, stand on the terrain, and so are kept level and clear of rocks and craters. The
 * places after them are further out than the terrain reaches.
 */
export const placeCount = 12;

/** How many of the Crew's landers can stand in one place, one behind another, that the ground is kept ready for. */
const landersPerPlace = 3;

/** The spots on the ground where Assets stand: each place, and the spots behind it where the Crew's later landers stand. */
export const standingSpots: readonly { x: number; z: number }[] = Array.from(
  { length: placeCount },
  (_, place) =>
    Array.from({ length: landersPerPlace }, (_, lander) =>
      landerSpot(place, lander),
    ),
).flat();

/** How far back from a place its last lander stands. */
export const landersReach =
  landerSpot(0, landersPerPlace - 1).z - landerSpot(0, 0).z;

/** Where a rover on a Long traverse from any place could drive, which rocks and small craters keep clear of. */
export const roverPaths: readonly { x: number; z: number }[] = Array.from(
  { length: placeCount },
  (_, place) => traversePaths(placeOf(place)),
).flat();

/** Whether a Crew member is at their place at Mars on a given day: arrived, and not yet lost. */
export function isThere(
  { fromDay, untilDay }: CrewMember,
  day: number,
): boolean {
  return day >= fromDay && (untilDay === null || day < untilDay);
}

/** Whether a Crew member is sheltering indoors from a dust storm on a given day. */
export function isIndoors({ shelter }: CrewMember, day: number): boolean {
  return shelter !== undefined && day >= shelter.fromDay && day < shelter.toDay;
}

/** What the player reads about the Crew at a Landing Site on a given day: who is there, and what they're doing. */
function describeCrew(
  { name, crew, activityName }: SurfaceAsset,
  day: number,
): string {
  const there = crew.filter((member) => isThere(member, day));
  const doing = there.some((member) => isIndoors(member, day))
    ? "sheltering from the dust storm"
    : activityName;
  return `Crew (${name}): ${there.map((member) => member.name).join(", ")}: ${doing}`;
}

/**
 * The Crew's landers at a Landing Site: one for each day Crew landed there, earliest first, by that day. Crew who land
 * where Crew already are join them, so they share one place, and each lander stands a little further back.
 */
export function crewLandersOf(crew: readonly CrewMember[]): number[] {
  return [...new Set(crew.map(({ arrivedOnDay }) => arrivedOnDay))].toSorted(
    (first, second) => first - second,
  );
}

/** Where one of the landers in a place is on the ground. The first stands on the place itself. */
export function landerSpot(
  place: number,
  lander: number,
): { x: number; z: number } {
  const { x, z } = placeOf(place);
  return { x, z: z + lander * 1.4 };
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

/** The dust storm over a Landing Site on a given day, if there is one. */
export function dustStormAt(
  { dustStorms }: Pick<Timeline, "dustStorms">,
  day: number,
  siteName: string,
): Timeline["dustStorms"][number] | null {
  return (
    dustStorms.find(
      (storm) =>
        storm.siteName === siteName &&
        day >= storm.fromDay &&
        day < storm.toDay,
    ) ?? null
  );
}

/**
 * What the player reads about a Landing Site on a given day, one line each. `leftFrom` says whether something has left
 * the site this Turn, through Mars ascent, so that it isn't new. `landingOnDay` is the day of the landing playing now,
 * whose own line names what is landing, so that what arrived that day is left out here rather than named twice.
 */
export function describeSite(
  timeline: Pick<Timeline, "assetsAtMars" | "mission">,
  day: number,
  siteName: string,
  leftFrom = false,
  landingOnDay: number | null = null,
): string[] {
  const atSite = surfaceAssetsAt(timeline, day, siteName);
  const here = atSite
    .filter(({ arrivedOnDay }) => arrivedOnDay !== landingOnDay)
    .map((asset) =>
      asset.model === "crewLander"
        ? describeCrew(asset, day)
        : `${asset.name} (${asset.kind}): ${activityAndCut(asset)}`,
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
  const nothing =
    crashedHere === true || leftFrom
      ? "Nothing operating here"
      : "Nothing here yet";
  return [
    ...(here.length > 0 || atSite.length > 0 ? here : [nothing]),
    ...(coming.length > 0 ? [`On its way: ${coming.join(", ")}`] : []),
  ];
}
