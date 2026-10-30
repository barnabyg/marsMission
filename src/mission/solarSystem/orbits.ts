import { addDays } from "../../simulation/simulation";

/** A position in the plane of the planets, in astronomical units, with the Sun at the origin. */
interface PlanePosition {
  x: number;
  z: number;
}

export type Planet = "earth" | "mars";

interface JourneyDays {
  launchDay: number;
  arrivalDay: number;
}

const millisecondsPerDay = 86_400_000;
const j2000 = Date.UTC(2000, 0, 1, 12);

/**
 * Circular orbits from mean longitudes at J2000 (ADR 0002). Good to within about 10 degrees,
 * which is all the view needs, because nothing in the rules depends on it.
 */
export const orbits = {
  earth: { radius: 1, longitudeAtJ2000: 100.464, periodDays: 365.256 },
  mars: { radius: 1.524, longitudeAtJ2000: 355.453, periodDays: 686.98 },
};

function longitudeDegrees(planet: Planet, isoDate: string): number {
  const { longitudeAtJ2000, periodDays } = orbits[planet];
  const days =
    (Date.parse(`${isoDate}T00:00:00Z`) - j2000) / millisecondsPerDay;
  return (longitudeAtJ2000 + (360 * days) / periodDays) % 360;
}

function fromPolar(radius: number, longitude: number): PlanePosition {
  const radians = (longitude * Math.PI) / 180;
  // z points towards the viewer, so planets go anticlockwise when seen from the north.
  return { x: radius * Math.cos(radians), z: -radius * Math.sin(radians) };
}

export function planetPosition(planet: Planet, isoDate: string): PlanePosition {
  return fromPolar(orbits[planet].radius, longitudeDegrees(planet, isoDate));
}

export function angleBetweenDegrees(
  first: PlanePosition,
  second: PlanePosition,
): number {
  const dot = first.x * second.x + first.z * second.z;
  const lengths = Math.hypot(first.x, first.z) * Math.hypot(second.x, second.z);
  return (Math.acos(dot / lengths) * 180) / Math.PI;
}

/** How far along its route a Mission is, from 0 at launch to 1 on arrival. */
export function journeyProgress(journey: JourneyDays, day: number): number {
  const { launchDay, arrivalDay } = journey;
  return Math.min(1, Math.max(0, (day - launchDay) / (arrivalDay - launchDay)));
}

/** A point along the route: outwards from Earth at launch to where Mars will be on arrival. */
export function routePosition(
  startDate: string,
  journey: JourneyDays,
  progress: number,
): PlanePosition {
  const from = longitudeDegrees("earth", addDays(startDate, journey.launchDay));
  const to = longitudeDegrees("mars", addDays(startDate, journey.arrivalDay));
  const sweep = (((to - from) % 360) + 360) % 360;
  const eased = progress * progress * (3 - 2 * progress);
  const radius =
    orbits.earth.radius + (orbits.mars.radius - orbits.earth.radius) * eased;
  return fromPolar(radius, from + sweep * progress);
}

export function spacecraftPosition(
  startDate: string,
  journey: JourneyDays,
  day: number,
): PlanePosition {
  return routePosition(startDate, journey, journeyProgress(journey, day));
}
