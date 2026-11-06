import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { daysWorking } from "./ongoingResearch";
import { sum, type Rules } from "./rules";
import type { Program } from "./types";

/*
 * Ascent propellant: what a fuel plant makes at its Landing Site, for Crew leaving the surface. Each fuel plant makes
 * its rate on each day it operates there, whatever its Activity, except while it shelters from a dust storm. It builds
 * up at the site from Turn to Turn, and stays there if the plant stops. Each site keeps its own.
 */

type Makes = NonNullable<Catalogue["assets"][number]["makes"]>;

/** What one Landing Site's fuel plants made during a Turn, for the Turn summary. */
export interface AscentPropellantMade {
  siteName: string;
  /** The fuel plants that made it, by name, each once. */
  madeBy: string[];
  madeKg: number;
  /** What the site has as the Turn ends, which includes what was made. */
  totalKg: number;
}

/** Ascent propellant in tonnes, as the player reads it, such as "7.8 t". */
export function formatPropellant(kg: number): string {
  const tonnes = (kg / 1000).toLocaleString("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${tonnes} t`;
}

/** What an Asset makes, if its design makes anything. */
function makesOf(catalogue: Catalogue, assetId: string): Makes | undefined {
  return catalogue.assets.find(({ id }) => id === assetId)?.makes;
}

/** What one Asset at a Landing Site makes this Turn: its rate for each day it operates there, less any it shelters. */
export function propellantMadeBy(
  catalogue: Catalogue,
  { asset, fromDay, untilDay, shelter }: AssetInService,
): number {
  const makes = makesOf(catalogue, asset.assetId);
  if (!makes || asset.landingSiteId === null) return 0;
  const days = daysWorking({
    fromDay,
    untilDay: untilDay ?? catalogue.program.launchWindowIntervalDays,
    shelter,
  });
  return (
    makes.ascentPropellantKgPerDay * sum(days.map(({ from, to }) => to - from))
  );
}

/** The ascent propellant at each Landing Site as the Turn ends, by the site's id, and what each site made. */
export function makeAscentPropellant(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  inService: AssetInService[],
): {
  ascentPropellantKg: Record<string, number>;
  made: AscentPropellantMade[];
} {
  const ascentPropellantKg = { ...program.ascentPropellantKg };
  const made: AscentPropellantMade[] = [];
  const siteIds = [
    ...new Set(
      inService.flatMap(({ asset }) =>
        asset.landingSiteId !== null && makesOf(catalogue, asset.assetId)
          ? [asset.landingSiteId]
          : [],
      ),
    ),
  ];
  for (const siteId of siteIds) {
    const plants = inService.filter(
      ({ asset }) =>
        asset.landingSiteId === siteId && makesOf(catalogue, asset.assetId),
    );
    const madeKg = sum(plants.map((stay) => propellantMadeBy(catalogue, stay)));
    const totalKg = (ascentPropellantKg[siteId] ?? 0) + madeKg;
    if (madeKg > 0) ascentPropellantKg[siteId] = totalKg;
    made.push({
      siteName: rules.landingSiteById(siteId)?.name ?? siteId,
      madeBy: [...new Set(plants.map(({ asset }) => asset.name))],
      madeKg,
      totalKg,
    });
  }
  return { ascentPropellantKg, made: made.filter(({ madeKg }) => madeKg > 0) };
}

/** What an Asset that makes ascent propellant makes over a whole Turn, for its Benefit tag, or null if it makes none. */
export function makesPerTurn(
  catalogue: Catalogue,
  asset: { makes?: Makes | undefined },
): { ascentPropellantKgPerTurn: number } | null {
  return asset.makes
    ? {
        ascentPropellantKgPerTurn:
          asset.makes.ascentPropellantKgPerDay *
          catalogue.program.launchWindowIntervalDays,
      }
    : null;
}

/** What making ascent propellant does, as Planning Mode describes it. */
export function describeMakes({ ascentPropellantKgPerDay }: Makes): string {
  return `Makes ${String(ascentPropellantKgPerDay)} kg of ascent propellant a day at its Landing Site, on each day it operates there, whatever its Activity. It is what Crew will need to leave the surface. It builds up from Turn to Turn and stays there if the plant stops, and a second one at the same site makes as much again.`;
}
