import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import type { CrewAtWork } from "./crewAtMars";
import type { HabitatDays } from "./health";
import { sum } from "./rules";
import type { Program } from "./types";

/*
 * Habitats: Assets that house the Crew at their Landing Site. On each day one operates there, whatever its Activity, it
 * slows the Health the Crew there lose to time at Mars by its share, dust storms and all, as the Crew shelter in it.
 * Habitats at one site don't add up their shares: on each day the largest applies.
 *
 * Each habitat lands holding its Supplies, which join the Supplies of the Crew at its site. The Crew draw on them once
 * their own run out, as Supplies left at the end of a Turn fill the habitats there first, up to what they hold, and the
 * rest are the Crew's. So Crew landing there with Supplies of their own top them up. A site's habitat Supplies are kept
 * while a habitat operates there. When the last stops, the Crew there keep what it held, and with no Crew there its
 * Supplies go with it.
 */

type Habitat = NonNullable<Catalogue["assets"][number]["habitat"]>;

/** What an Asset does for Crew, if its design is a habitat. */
function habitatOf(catalogue: Catalogue, assetId: string): Habitat | undefined {
  return catalogue.assets.find(({ id }) => id === assetId)?.habitat;
}

/** The habitats at this Landing Site at any time this Turn, with what each does. */
function habitatsAt(
  catalogue: Catalogue,
  inService: readonly AssetInService[],
  siteId: string,
): { stay: AssetInService; habitat: Habitat }[] {
  return inService.flatMap((stay) => {
    const habitat = habitatOf(catalogue, stay.asset.assetId);
    return habitat && stay.asset.landingSiteId === siteId
      ? [{ stay, habitat }]
      : [];
  });
}

/** The days this Turn on which habitats at this Landing Site slow time at Mars there, and by how much. */
export function habitatDaysAt(
  catalogue: Catalogue,
  inService: readonly AssetInService[],
  siteId: string | null,
): HabitatDays[] {
  if (siteId === null) return [];
  return habitatsAt(catalogue, inService, siteId)
    .map(({ stay, habitat }) => ({
      fromDay: stay.fromDay,
      toDay: stay.untilDay ?? catalogue.program.launchWindowIntervalDays,
      cutPercent: habitat.timeAtMarsCutPercent,
    }))
    .filter(({ fromDay, toDay }) => toDay > fromDay);
}

/**
 * The habitat Supplies that join those of the Crew at this Landing Site this Turn: what the habitats there held as it
 * started, and what each habitat landing this Turn brings, on the day it lands.
 */
export function habitatSuppliesFor(
  catalogue: Catalogue,
  program: Program,
  inService: readonly AssetInService[],
  siteId: string,
): { startKg: number; refills: { day: number; kg: number }[] } {
  return {
    startKg: program.habitatSuppliesKg[siteId] ?? 0,
    refills: habitatsAt(catalogue, inService, siteId)
      .filter(({ stay }) => stay.fromDay > 0)
      .map(({ stay, habitat }) => ({
        day: stay.fromDay,
        kg: habitat.suppliesKg,
      })),
  };
}

/**
 * The Supplies held in habitats at each Landing Site as the Turn ends, and the Crew's own Supplies in each place after
 * the habitats there have been filled from what is left.
 */
export function storeHabitatSupplies(
  catalogue: Catalogue,
  program: Program,
  inService: readonly AssetInService[],
  crewAtWork: readonly CrewAtWork[],
  crewSupplies: Record<string, number>,
): {
  habitatSuppliesKg: Record<string, number>;
  crewSupplies: Record<string, number>;
} {
  const habitatSuppliesKg: Record<string, number> = {};
  const crewLeft = { ...crewSupplies };
  const siteIds = new Set(
    inService.flatMap(({ asset }) =>
      asset.landingSiteId !== null && habitatOf(catalogue, asset.assetId)
        ? [asset.landingSiteId]
        : [],
    ),
  );
  for (const siteId of siteIds) {
    const habitats = habitatsAt(catalogue, inService, siteId);
    const holds = sum(
      habitats
        .filter(({ stay }) => stay.untilDay === null)
        .map(({ habitat }) => habitat.suppliesKg),
    );
    if (holds === 0) continue;
    const crew = crewAtWork.find(
      ({ place }) =>
        place.kind === "landingSite" && place.landingSiteId === siteId,
    );
    if (crew) {
      const left = crew.supplies.leftKg;
      const held = Math.min(left, holds);
      habitatSuppliesKg[siteId] = held;
      if (crew.key in crewLeft) {
        crewLeft[crew.key] = Math.round((left - held) * 1000) / 1000;
      }
    } else {
      const { startKg, refills } = habitatSuppliesFor(
        catalogue,
        program,
        inService,
        siteId,
      );
      habitatSuppliesKg[siteId] = Math.min(
        startKg + sum(refills.map(({ kg }) => kg)),
        holds,
      );
    }
  }
  return { habitatSuppliesKg, crewSupplies: crewLeft };
}

/** What a habitat would do over a Crew member's stay, for its Benefit tag, or null if the Asset isn't a habitat. */
export function habitatBenefit(
  catalogue: Catalogue,
  asset: { habitat?: Habitat | undefined },
): {
  timeAtMarsCutPercent: number;
  suppliesKg: number;
  extraDays: number;
} | null {
  if (!asset.habitat) return null;
  const { maxHealth, health } = catalogue.crew;
  const { timeAtMarsCutPercent, suppliesKg } = asset.habitat;
  const lasts = (timePerDay: number) =>
    Math.floor(maxHealth / (health.radiationPerDay.atMars + timePerDay));
  return {
    timeAtMarsCutPercent,
    suppliesKg,
    extraDays:
      lasts((health.timeAtMarsPerDay * (100 - timeAtMarsCutPercent)) / 100) -
      lasts(health.timeAtMarsPerDay),
  };
}

/** What a habitat does, as Planning Mode describes it. */
export function describeHabitat({
  timeAtMarsCutPercent,
  suppliesKg,
}: Habitat): string {
  return `Houses the Crew at its Landing Site on each day it operates there, whatever its Activity, which slows the Health they lose to time at Mars by ${String(timeAtMarsCutPercent)}%. A second one at the same site slows it no more. It lands holding ${suppliesKg.toLocaleString("en")} kg of Supplies, which the Crew there draw on once their own run out and which Crew landing there top up.`;
}
