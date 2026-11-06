import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { sum } from "./sum";

/**
 * Anything impossible about ascent propellant over one Turn, read from the Program before it, its summary and the
 * Program after it: it is a whole number of kilograms that never falls, each site gains what the Turn summary says it
 * made there, and only fuel plants at that site make it.
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
          ascentPropellantKg < (kgBefore.get(name) ?? 0),
      ),
      "Ascent propellant fell at a Landing Site, though nothing uses it yet.",
    ],
    [
      after.landingSites.some(
        ({ name, ascentPropellantKg }) =>
          ascentPropellantKg - (kgBefore.get(name) ?? 0) !== madeAt(name),
      ),
      "A Landing Site's ascent propellant didn't change by what the Turn summary says was made there.",
    ],
    [
      summary.ascentPropellant.some(
        ({ siteName, totalKg }) =>
          after.landingSites.find(({ name }) => name === siteName)
            ?.ascentPropellantKg !== totalKg,
      ),
      "The Turn summary's ascent propellant at a Landing Site doesn't match the next Program's.",
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
