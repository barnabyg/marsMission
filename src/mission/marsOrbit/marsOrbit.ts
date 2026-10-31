import type { Timeline } from "../../simulation/simulation";
import { assetsAtMarsOn } from "../journey";
import { degreesToRadians, type Point } from "../sceneParts";

/** How far an orbiter is from the middle of Mars, whose radius is 1 in this view. */
export const orbitRadius = 1.7;

/** Deliberately slow, because the true rate would be a blur at these speeds. */
const orbitRadiansPerDay = 0.08;

/** Spaces out any number of orbiters without moving those already there when another arrives. */
const goldenAngle = 2.39996;

interface Orbiter {
  name: string;
  /** Its place among the Turn's Assets at Mars, which stays the same all Turn. */
  slot: number;
}

/** The Assets going round Mars on a given day. */
export function orbitersOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): Orbiter[] {
  return assetsAtMarsOn(timeline, day)
    .filter((asset) => asset.landingSiteName === null)
    .map((asset) => ({
      name: asset.name,
      slot: timeline.assetsAtMars.indexOf(asset),
    }));
}

/** Where an orbiter is, relative to the middle of Mars. */
export function orbiterPosition(slot: number, day: number): Point {
  const angle = day * orbitRadiansPerDay + slot * goldenAngle;
  return [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius];
}

type Mission = Pick<NonNullable<Timeline["mission"]>, "arrivalDay" | "assets">;

/** Mars's true tilt, leaning away from the camera so that the equator faces it. */
export const marsTiltRadians = -25.2 * degreesToRadians;

/** Deliberately slow, because the true rate would be a blur at these speeds. */
const spinRadiansPerDay = 0.02;

/**
 * A landing is shown around its day rather than ending on it, because the view may only move there
 * when the landing happens, and at 10x the camera takes several days to arrive.
 */
const descentDaysBefore = 5;
const descentDaysAfter = 10;

type Sites = Timeline["landingSites"];

function coordinatesOf(sites: Sites, siteName: string) {
  const site = sites.find(({ name }) => name === siteName);
  // The Simulation lists every site it can name.
  if (!site) throw new Error(`The Timeline has no Landing Site "${siteName}"`);
  return site;
}

/** The day an Asset reaches the surface, in one piece or not, or null if it doesn't. */
function landingDayOf(asset: Mission["assets"][number]): number | null {
  if (asset.landingSiteName === null) return null;
  return asset.crashed ? asset.lostOnDay : asset.deliveredOnDay;
}

interface LandingMarker {
  name: string;
  siteName: string;
  /** How far it still has to come down, from 1 in orbit to 0 on the surface. */
  altitude: number;
  crashed: boolean;
}

/** The Mission's Assets on their way down on a given day, and any that have crashed. */
export function landingMarkersOn(
  mission: Mission | null,
  day: number,
): LandingMarker[] {
  if (!mission) return [];
  return mission.assets.flatMap((asset) => {
    const landingDay = landingDayOf(asset);
    if (landingDay === null || asset.landingSiteName === null) return [];
    const start = Math.max(mission.arrivalDay, landingDay - descentDaysBefore);
    const end = landingDay + descentDaysAfter;
    if (day < start || (!asset.crashed && day >= end)) return [];
    return [
      {
        name: asset.name,
        siteName: asset.landingSiteName,
        altitude: Math.max(0, 1 - (day - start) / (end - start)),
        crashed: asset.crashed && day >= landingDay,
      },
    ];
  });
}

/** The Assets settled on the surface on a given day. One that has just landed joins them once its marker is down. */
export function landedOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): { name: string; siteName: string }[] {
  return assetsAtMarsOn(timeline, day).flatMap(
    ({ name, landingSiteName, fromDay }) =>
      landingSiteName === null ||
      (fromDay > 0 && day < fromDay + descentDaysAfter)
        ? []
        : [{ name, siteName: landingSiteName }],
  );
}

/** How far Mars has turned. In a Turn with a landing, it has the Landing Site facing the camera on the day. */
export function globeSpin(
  sites: Sites,
  mission: Mission | null,
  day: number,
): number {
  const landing = mission?.assets.find((asset) => landingDayOf(asset) !== null);
  const landingDay = landing ? (landingDayOf(landing) ?? 0) : 0;
  const longitude = landing?.landingSiteName
    ? coordinatesOf(sites, landing.landingSiteName).longitude
    : 0;
  return (
    -Math.PI / 2 -
    longitude * degreesToRadians +
    spinRadiansPerDay * (day - landingDay)
  );
}

/**
 * A point on the surface of the turning, tilted globe, relative to its middle. Each `place` is a
 * little further north, which keeps Assets at the same Landing Site and their labels apart.
 */
export function surfacePoint(
  sites: Sites,
  siteName: string,
  spin: number,
  place: number,
): Point {
  const { latitude, longitude } = coordinatesOf(sites, siteName);
  const north = (latitude + place * 4) * degreesToRadians;
  const east = longitude * degreesToRadians + spin;
  const across = Math.cos(north) * Math.cos(east);
  const up = Math.sin(north);
  const out = -Math.cos(north) * Math.sin(east);
  return [
    across,
    up * Math.cos(marsTiltRadians) - out * Math.sin(marsTiltRadians),
    up * Math.sin(marsTiltRadians) + out * Math.cos(marsTiltRadians),
  ];
}
