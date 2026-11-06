import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { sum } from "./sum";

/**
 * Anything impossible about ascent propellant over one Turn, read from the Program before it, its summary and the
 * Program after it: it is a whole number of kilograms that only Mars ascent uses, each site changes by what the Turn
 * summary says it made and used there, only fuel plants at that site make it, and only Crew leaving that site use it,
 * as much as Mars ascent needs, from no less than that.
 */
export function propellantProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const kgBefore = new Map(
    before.landingSites.map(({ name, ascentPropellantKg }) => [
      name,
      ascentPropellantKg,
    ]),
  );
  const makers = new Set(
    before.assets.filter(({ makes }) => makes !== null).map(({ name }) => name),
  );
  const madeAt = (siteName: string) =>
    sum(
      summary.ascentPropellant
        .filter((made) => made.siteName === siteName)
        .map(({ madeKg }) => madeKg),
    );
  /** The fuel plants at this site as the Turn started or ended, by name. */
  const plantsAt = (siteName: string) =>
    new Set(
      [...before.operatingAssets, ...after.operatingAssets]
        .filter(
          ({ name, landingSiteName }) =>
            landingSiteName === siteName && makers.has(name),
        )
        .map(({ name }) => name),
    );
  const usedAt = (siteName: string) =>
    sum(
      summary.ascentPropellantUsed
        .filter((used) => used.siteName === siteName)
        .map(({ usedKg }) => usedKg),
    );
  const needKg = before.crewedMission.roundTrip.ascentPropellantKg;
  const leavers = new Set(summary.journeyHome?.crew ?? []);
  /** Where the Crew on the Turn's journey home were as it started, if at a Landing Site. */
  const leftFrom = before.crew.find(
    ({ landingSiteId, members }) =>
      landingSiteId !== null && members.some(({ name }) => leavers.has(name)),
  )?.locationName;
  const checks: [impossible: boolean, problem: string][] = [
    [
      after.landingSites.some(
        ({ ascentPropellantKg }) =>
          ascentPropellantKg < 0 || !Number.isInteger(ascentPropellantKg),
      ),
      "A Landing Site has a negative or fractional amount of ascent propellant.",
    ],
    [
      after.landingSites.some(
        ({ name, ascentPropellantKg }) =>
          ascentPropellantKg < (kgBefore.get(name) ?? 0) - usedAt(name),
      ),
      "Ascent propellant fell at a Landing Site by more than Mars ascent used there.",
    ],
    [
      after.landingSites.some(
        ({ name, ascentPropellantKg }) =>
          ascentPropellantKg - (kgBefore.get(name) ?? 0) !==
          madeAt(name) - usedAt(name),
      ),
      "A Landing Site's ascent propellant didn't change by what the Turn summary says was made and used there.",
    ],
    [
      [...summary.ascentPropellant, ...summary.ascentPropellantUsed].some(
        ({ siteName, totalKg }) =>
          after.landingSites.find(({ name }) => name === siteName)
            ?.ascentPropellantKg !== totalKg,
      ),
      "The Turn summary's ascent propellant at a Landing Site doesn't match the next Program's.",
    ],
    [
      summary.ascentPropellantUsed.some(
        ({ siteName, usedKg }) =>
          siteName !== leftFrom ||
          usedKg !== needKg ||
          (kgBefore.get(siteName) ?? 0) < needKg,
      ),
      "Ascent propellant was used at a Landing Site that Crew didn't leave, or not as much as Mars ascent needs, or with too little there.",
    ],
    [
      leftFrom !== undefined &&
        summary.ascentPropellantUsed.length === 0 &&
        summary.journeyHome?.failure === null &&
        summary.crewHome.length > 0,
      "Crew came home from a Landing Site without using any ascent propellant.",
    ],
    [
      summary.ascentPropellant.some(
        ({ siteName, madeBy, madeKg }) =>
          madeKg <= 0 ||
          madeBy.length === 0 ||
          madeBy.some((name) => !plantsAt(siteName).has(name)),
      ),
      "Ascent propellant was made at a Landing Site by something other than a fuel plant there.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
