import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { daysWorking } from "./ongoingResearch";
import { sum, type Activity, type Rules } from "./rules";
import type { Program } from "./types";

/*
 * Sample caching: an Asset on a Sample caching Activity collects its share of the Activity's samples for each day it
 * does it at its Landing Site, rounded up for the Turn, as Ongoing Research is, except while it shelters from a dust
 * storm. The samples stay at the site from Turn to Turn until a journey home takes those there as a Turn starts.
 */

/** The samples cached at one Landing Site during a Turn, for the Turn summary. */
export interface SamplesCached {
  siteName: string;
  /** The Assets that cached them, by name, each once. */
  cachedBy: string[];
  samples: number;
  /** What the site holds as the Turn ends, after any taken home and with these. */
  totalSamples: number;
}

/** The samples an Activity caches over a whole Turn, or null if it doesn't cache any. */
function samplesPerTurnOf(activity: Activity | undefined): number | null {
  return activity?.effect.kind === "sampleCaching"
    ? activity.effect.samplesPerTurn
    : null;
}

/** What Planning Mode says Sample caching collects over a whole Turn, and the Science those samples earn once home. */
export function cachesPerTurn(
  catalogue: Catalogue,
  activity: Activity,
): { samples: number; science: number } | null {
  const samples = samplesPerTurnOf(activity);
  return samples === null
    ? null
    : { samples, science: samples * catalogue.program.sciencePerSampleHome };
}

/** The samples one Asset at a Landing Site caches this Turn: its share for each day it does it, rounded up. */
function samplesCachedBy(
  catalogue: Catalogue,
  rules: Rules,
  { asset, fromDay, untilDay, shelter }: AssetInService,
): number {
  const perTurn = samplesPerTurnOf(rules.activityById(asset.activityId));
  if (perTurn === null || asset.landingSiteId === null) return 0;
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const days = sum(
    daysWorking({ fromDay, untilDay: untilDay ?? turnDays, shelter }).map(
      ({ from, to }) => to - from,
    ),
  );
  return days > 0 ? Math.ceil((perTurn * days) / turnDays) : 0;
}

/**
 * The samples at each Landing Site as the Turn ends, by the site's id, and what each site cached: those there as the
 * Turn started, less any a journey home took from the site it left, with what was cached there this Turn.
 */
export function cacheSamples(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  inService: AssetInService[],
  takenFrom: string | null,
): { samplesAtSites: Record<string, number>; cached: SamplesCached[] } {
  const samplesAtSites = { ...program.samplesAtSites };
  if (takenFrom !== null) samplesAtSites[takenFrom] = 0;
  const cached: SamplesCached[] = [];
  const caching = inService.flatMap((stay) => {
    const samples = samplesCachedBy(catalogue, rules, stay);
    const siteId = stay.asset.landingSiteId;
    return samples > 0 && siteId !== null ? [{ stay, siteId, samples }] : [];
  });
  for (const siteId of new Set(caching.map((each) => each.siteId))) {
    const here = caching.filter((each) => each.siteId === siteId);
    const samples = sum(here.map((each) => each.samples));
    const totalSamples = (samplesAtSites[siteId] ?? 0) + samples;
    samplesAtSites[siteId] = totalSamples;
    cached.push({
      siteName: rules.landingSiteById(siteId)?.name ?? siteId,
      cachedBy: [...new Set(here.map(({ stay }) => stay.asset.name))],
      samples,
      totalSamples,
    });
  }
  return { samplesAtSites, cached };
}
