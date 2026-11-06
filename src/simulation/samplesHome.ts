import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { cacheSamples } from "./sampleCaching";
import type { TurnSummary } from "./turnSummary";
import type { JourneyHome } from "./journeyHome";
import { locationNameOf } from "./crewPlaces";
import type { Rules } from "./rules";
import type { SampleJourney } from "./sampleReturn";
import type { MilestoneAward } from "./scienceMilestones";
import type { SamplesEntry } from "./timeline";
import type { PlaceAtMars, Program } from "./types";

/*
 * Samples reaching Earth: each earns the Catalogue's Science for a returned sample on the day it gets home, and the
 * first earn the First samples returned Milestone. They come home aboard an Earth return orbiter (`sampleReturn.ts`), or
 * with Crew coming home from a Landing Site, who bring the samples cached there as the Turn starts and samples of their
 * own for each of them who gets home.
 */

/** Samples that reached Earth together on one day of the Turn, from one Landing Site. */
export interface SamplesHomecoming {
  siteName: string;
  samples: number;
  day: number;
  /** What brought them: an Earth return orbiter, by name, or "Crew". */
  broughtBy: string;
}

/** The samples Crew leaving a Landing Site would bring home: those cached there, and their own for each of them. */
export function samplesWithCrew(
  catalogue: Catalogue,
  program: Program,
  from: PlaceAtMars,
  crew: number,
): number {
  if (from.kind !== "landingSite") return 0;
  return (
    (program.samplesAtSites[from.landingSiteId] ?? 0) +
    crew * catalogue.crew.roundTrip.ascent.samplesPerMember
  );
}

/**
 * What the Turn's journey home of Crew does with samples: the Landing Site it took them from, if any, how many were
 * aboard, and those that came home with the Crew who did.
 */
function crewSamplesHome(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  from: PlaceAtMars | null,
  journey: JourneyHome | null,
): {
  takenFrom: string | null;
  aboard: number;
  homecomings: SamplesHomecoming[];
} {
  if (from?.kind !== "landingSite" || !journey) {
    return { takenFrom: null, aboard: 0, homecomings: [] };
  }
  const home = journey.outcome.deliveredCrew.length;
  const failed =
    journey.outcome.failedEvent !== undefined ||
    journey.outcome.decisionPoint !== null;
  return {
    takenFrom: from.landingSiteId,
    aboard: samplesWithCrew(catalogue, program, from, journey.crew.length),
    homecomings:
      home > 0 && !failed
        ? [
            {
              siteName: locationNameOf(rules, from),
              samples: samplesWithCrew(catalogue, program, from, home),
              day: journey.homeOn,
              broughtBy: "Crew",
            },
          ]
        : [],
  };
}

/** The samples a journey home of samples brought to Earth, if it did. */
function robotSamplesHome(journey: SampleJourney | null): SamplesHomecoming[] {
  return journey?.home
    ? [
        {
          siteName: journey.siteName,
          samples: journey.samples,
          day: journey.homeOn,
          broughtBy: journey.outcome.vehicleName ?? "",
        },
      ]
    : [];
}

/** What the Turn's samples home earn: Science on the day they arrive, and the First samples returned Milestone. */
function welcomeSamplesHome(
  catalogue: Catalogue,
  program: Program,
  homecomings: readonly SamplesHomecoming[],
): {
  entries: SamplesEntry[];
  awards: MilestoneAward[];
  lumps: { day: number; amount: number }[];
  science: number;
  summary: {
    from: string;
    samples: number;
    science: number;
    broughtBy: string;
  }[];
} {
  const each = catalogue.program.sciencePerSampleHome;
  const home = homecomings
    .filter(({ samples }) => samples > 0)
    .toSorted((first, second) => first.day - second.day);
  const summary = home.map(({ siteName, samples, broughtBy }) => ({
    from: siteName,
    samples,
    science: samples * each,
    broughtBy,
  }));
  const entries = home.map(
    ({ siteName, samples, day, broughtBy }): SamplesEntry => ({
      kind: "samples",
      day,
      title: "Samples home",
      description: `${String(samples)} samples from ${siteName} reached Earth ${broughtBy === "Crew" ? "with the Crew" : `aboard the ${broughtBy}`}, which earns ${String(samples * each)} Science.`,
    }),
  );
  const [first] = home;
  const awards = first
    ? catalogue.milestones
        .filter(
          ({ id, trigger }) =>
            "samplesComeHome" in trigger && !program.milestoneIds.includes(id),
        )
        .map((milestone) => ({ milestone, day: first.day }))
    : [];
  const lumps = home.map(({ samples, day }) => ({
    day,
    amount: samples * each,
  }));
  return {
    entries,
    awards,
    lumps,
    science: lumps.reduce((total, { amount }) => total + amount, 0),
    summary,
  };
}

/**
 * What the Turn does with samples once its journey home has flown: what each Landing Site cached, what is left at each
 * as the Turn ends, after any taken home, how many flew with Crew, and what those that reached Earth earn.
 */
export function settleSamples(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  inService: AssetInService[],
  journeys: {
    crew: { from: PlaceAtMars; journey: JourneyHome } | null;
    robotic: SampleJourney | null;
  },
) {
  const { crew, robotic } = journeys;
  const withCrew = crewSamplesHome(
    catalogue,
    rules,
    program,
    crew?.from ?? null,
    crew?.journey ?? null,
  );
  const cached = cacheSamples(
    catalogue,
    rules,
    program,
    inService,
    withCrew.takenFrom ?? (robotic && !robotic.stayed ? robotic.siteId : null),
  );
  return {
    ...cached,
    withCrew: withCrew.aboard,
    welcome: welcomeSamplesHome(catalogue, program, [
      ...withCrew.homecomings,
      ...robotSamplesHome(robotic),
    ]),
  };
}

/** The Turn summary's account of a journey home of samples, if one was sent. */
export function sampleJourneySummary(
  journey: SampleJourney | null,
  publicSupportLost: number,
): TurnSummary["sampleJourney"] {
  return (
    journey && {
      siteName: journey.siteName,
      samples: journey.samples,
      failure: journey.outcome.failedEvent
        ? {
            missionEventName: journey.outcome.failedEvent.name,
            publicSupportLost,
          }
        : null,
      stayed: journey.stayed,
    }
  );
}
