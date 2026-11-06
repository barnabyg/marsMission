import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { tryContingency } from "./contingency";
import { journeyHomeDays } from "./earthReturnStages";
import { outcomeBefore, type Flight, type MissionOutcome } from "./flight";
import { homewardText } from "./journeyHome";
import { missionEventFailed } from "./missionEventFailure";
import {
  addDays,
  daysUntilServiceEnds,
  operatingKey,
  roll,
  type Rules,
} from "./rules";
import type { SamplesEntry } from "./timeline";
import type {
  DecisionAnswers,
  PlannedMission,
  Program,
  SampleWayHome,
  TurnPlan,
} from "./types";

/*
 * Sending samples home: on a Turn the player chooses, an ascent vehicle at a Landing Site lifts the samples cached
 * there off the surface through Mars ascent and docks with an Earth return orbiter in Mars orbit, which flies them home
 * through the journey home's Mission Events, as Crew's are flown (`journeyHome.ts`), with the Reliability and
 * Contingencies their Missions bought. A robotic ascent needs no ascent propellant. A failure loses the samples and
 * what was flying them then: the ascent vehicle up to the rendezvous, which leaves the orbiter waiting, and the orbiter
 * after it. Both leave Mars for good once they have flown their part.
 */

type OperatingAsset = Program["operatingAssets"][number];

const keyPrefix = "samples:";

/** How a plan names a Landing Site's samples to send them home. */
const samplesKeyOf = (siteId: string) => `${keyPrefix}${siteId}`;

/** Whether a plan's journey home is a Landing Site's samples, rather than Crew. */
export const isSamplesKey = (key: string | undefined): boolean =>
  key?.startsWith(keyPrefix) === true;

/** The Landing Site whose samples a plan sends home, by id, or null if it sends none. */
const siteSentHome = (plan: TurnPlan): string | null =>
  plan.bringHome !== undefined && isSamplesKey(plan.bringHome)
    ? plan.bringHome.slice(keyPrefix.length)
    : null;

const roleOf = (catalogue: Catalogue, asset: OperatingAsset) =>
  catalogue.assets.find(({ id }) => id === asset.assetId)?.sampleReturn;

/**
 * The ascent vehicle at this site and the Earth return orbiter in Mars orbit that would fly its samples home this Turn,
 * the first of each operating as the Turn starts whose mission the plan doesn't end, and whose Service Life lasts past
 * the day the samples would leave.
 */
function vehiclesFor(
  catalogue: Catalogue,
  program: Program,
  siteId: string,
  endedKeys: readonly string[],
): { ascent: OperatingAsset | undefined; orbiter: OperatingAsset | undefined } {
  const leavesOn = catalogue.crew.roundTrip.leavesMarsOnDay;
  const ready = (asset: OperatingAsset) =>
    !endedKeys.includes(operatingKey(asset)) &&
    daysUntilServiceEnds(program.date, asset) > leavesOn;
  const candidates = program.operatingAssets.filter(ready);
  return {
    ascent: candidates.find(
      (asset) =>
        roleOf(catalogue, asset) === "ascent" && asset.landingSiteId === siteId,
    ),
    orbiter: candidates.find(
      (asset) =>
        roleOf(catalogue, asset) === "earthReturn" &&
        asset.landingSiteId === null,
    ),
  };
}

/** Why a site's samples can't go home this Turn, or null if they can. */
function reasonFor(
  siteName: string,
  samples: number,
  { ascent, orbiter }: ReturnType<typeof vehiclesFor>,
): string | null {
  if (samples === 0) return `There are no samples at ${siteName} to send home.`;
  if (!ascent) {
    return `Samples at ${siteName} need an ascent vehicle there to lift them into Mars orbit.`;
  }
  if (!orbiter) {
    return `Samples at ${siteName} need an Earth return orbiter waiting in Mars orbit to fly them home.`;
  }
  return null;
}

/** A Landing Site's name, or for one the Catalogue doesn't have, words that don't show the player its id. */
const siteNameOf = (rules: Rules, siteId: string) =>
  rules.landingSiteById(siteId)?.name ?? "that Landing Site";

/** The choices Planning Mode offers to send samples home, one for each Landing Site with any, in the Catalogue's order. */
export function sampleReturnsOf(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
): SampleWayHome[] {
  const { leavesOn, homeOn } = journeyHomeDays(catalogue, rules);
  return catalogue.landingSites.flatMap(({ id, name }) => {
    const samples = program.samplesAtSites[id] ?? 0;
    if (samples === 0) return [];
    const vehicles = vehiclesFor(catalogue, program, id, []);
    return [
      {
        key: samplesKeyOf(id),
        siteName: name,
        samples,
        science: samples * catalogue.program.sciencePerSampleHome,
        ascentVehicle: vehicles.ascent?.name ?? null,
        orbiter: vehicles.orbiter?.name ?? null,
        leavesMarsOn: addDays(program.date, leavesOn),
        homeOn: addDays(program.date, homeOn),
        reason: reasonFor(name, samples, vehicles),
      },
    ];
  });
}

/** What's wrong with sending the samples a plan names home, if it names any. */
export function sampleReturnProblems(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): string[] {
  const siteId = siteSentHome(plan);
  if (siteId === null) return [];
  const reason = reasonFor(
    siteNameOf(rules, siteId),
    program.samplesAtSites[siteId] ?? 0,
    vehiclesFor(catalogue, program, siteId, plan.endedAssetKeys ?? []),
  );
  return reason === null ? [] : [reason];
}

/** The samples a plan sends home this Turn, and what flies them, once the plan has passed validation. */
interface SamplesComingHome {
  siteId: string;
  samples: number;
  ascent: OperatingAsset;
  orbiter: OperatingAsset;
}

/** The samples a plan sends home this Turn, if it sends any, from a Program whose ended missions have already ended. */
function samplesComingHome(
  catalogue: Catalogue,
  program: Program,
  plan: TurnPlan,
): SamplesComingHome | null {
  const siteId = siteSentHome(plan);
  if (siteId === null) return null;
  const { ascent, orbiter } = vehiclesFor(catalogue, program, siteId, []);
  const samples = program.samplesAtSites[siteId] ?? 0;
  return ascent && orbiter && samples > 0
    ? { siteId, samples, ascent, orbiter }
    : null;
}

/** What became of the samples a plan sent home, as far as the answers so far take it. */
export interface SampleJourney {
  siteId: string;
  siteName: string;
  samples: number;
  /** The day of the Turn they get home if nothing goes wrong. */
  homeOn: number;
  /**
   * Whether they stayed at their site because the ascent vehicle or the orbiter stopped operating before the day they
   * would leave, so that nothing flew.
   */
  stayed: boolean;
  /** Whether they reached Earth. */
  home: boolean;
  /** Their journey's Mission Events, failure and Decision Point. Nothing has happened to it if they stayed. */
  outcome: MissionOutcome;
  /** When the ascent vehicle and the orbiter left Mars for good, by their \`operatingKey\`, which is never for one that didn't. */
  leftMars: Map<string, number>;
  /** The entry saying they stayed at their site, if they did. */
  entries: SamplesEntry[];
}

/**
 * Flies the samples a plan sends home this Turn, if it sends any, from a Program whose ended missions have already
 * ended, as long as what flies them is still operating on the day they leave.
 */
export function sendSamplesHome(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  inService: readonly AssetInService[],
  answers: DecisionAnswers,
): SampleJourney | null {
  const coming = samplesComingHome(catalogue, program, plan);
  return (
    coming &&
    flySamplesHome(catalogue, rules, program, coming, inService, answers)
  );
}

/** Flies a Landing Site's samples home, if what flies them is still operating on the day they leave. */
function flySamplesHome(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  coming: SamplesComingHome,
  inService: readonly AssetInService[],
  answers: DecisionAnswers,
): SampleJourney {
  const { leavesOn, homeOn } = journeyHomeDays(catalogue, rules);
  const siteName = siteNameOf(rules, coming.siteId);
  const cargo = `${String(coming.samples)} samples from ${siteName}`;
  const ascentEvents = new Set(catalogue.crew.roundTrip.ascent.missionEvents);
  const flight = samplesFlight(catalogue, rules, program, coming, answers, {
    ascent: (eventId) => ascentEvents.has(eventId),
    cargo,
  });
  const journey: SampleJourney = {
    siteId: coming.siteId,
    siteName,
    samples: coming.samples,
    homeOn,
    stayed: false,
    home: false,
    outcome: flight.outcome,
    leftMars: new Map(),
    entries: [],
  };
  const operatingOn = (asset: OperatingAsset) =>
    inService.some(
      (stay) =>
        operatingKey(stay.asset) === operatingKey(asset) &&
        (stay.untilDay === null || stay.untilDay > leavesOn),
    );
  if (!operatingOn(coming.ascent) || !operatingOn(coming.orbiter)) {
    journey.stayed = true;
    journey.entries.push({
      kind: "samples",
      day: leavesOn,
      title: `Samples stay at ${siteName}`,
      description: `The ${String(coming.samples)} samples at ${siteName} couldn't leave for home, because what was to fly them stopped operating first. They stay there for a later Turn.`,
    });
    return journey;
  }
  const ascentKey = operatingKey(coming.ascent);
  const orbiterKey = operatingKey(coming.orbiter);
  const orbiter = catalogue.assets.filter(
    ({ id }) => id === coming.orbiter.assetId,
  );
  for (const event of rules.journeyHomeEvents(true)) {
    const day = flight.dayOf(event);
    // Until the rendezvous is done, the orbiter is safe in Mars orbit, which a failure says.
    flight.outcome.deliveredAssets = ascentEvents.has(event.id) ? orbiter : [];
    // Whatever flies a Mission Event has left Mars for good, whatever comes of it.
    if (ascentEvents.has(event.id)) {
      if (!journey.leftMars.has(ascentKey))
        journey.leftMars.set(ascentKey, day);
    } else if (!journey.leftMars.has(orbiterKey)) {
      journey.leftMars.set(orbiterKey, day);
    }
    const risk = rules.failureProbability(
      event,
      rules.reliabilityLevelFor(flight.mission, event.id),
      program,
      flight.mission,
    );
    if (roll(program.seed, program.turnNumber, event.id) >= risk) {
      flight.outcome.entries.push({
        ...flight.happened(event),
        title: event.name,
        description: flight.filledIn(event.description),
        outcome: "success",
        homeward: true,
      });
      continue;
    }
    const contingency = tryContingency(flight, event, []);
    if (contingency.kind === "rescued") continue;
    if (contingency.kind === "failed") {
      missionEventFailed(flight, event, [], contingency.used);
    }
    break;
  }
  const { outcome } = flight;
  journey.home = outcome.failedEvent === undefined && !outcome.decisionPoint;
  outcome.entries = outcome.entries.map((entry) =>
    entry.kind === "missionEvent" ? { ...entry, homeward: true } : entry,
  );
  return journey;
}

/** The samples' journey as a `Flight`, on the day it leaves Mars, with nothing yet happened to it. */
function samplesFlight(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  coming: SamplesComingHome,
  answers: DecisionAnswers,
  { ascent, cargo }: { ascent: (eventId: string) => boolean; cargo: string },
): Flight {
  const { leavesOn } = journeyHomeDays(catalogue, rules);
  const bought = [coming.ascent.homeward, coming.orbiter.homeward];
  // What the two Missions bought for the journey home, as a Mission with nothing aboard.
  const mission: PlannedMission = {
    launchVehicleId: "",
    assetIds: [],
    reliability: Object.fromEntries(
      bought.flatMap((it) => Object.entries(it?.reliability ?? {})),
    ),
    contingencyIds: bought.flatMap((it) => it?.contingencyIds ?? []),
  };
  const outcome = outcomeBefore(coming.orbiter.name, [], [], undefined);
  const flight: Flight = {
    catalogue,
    rules,
    program,
    mission,
    answers,
    assets: [],
    crew: [],
    radiationCutPercent: 0,
    landingSite: undefined,
    freeReturn: undefined,
    outcome,
    daysHeld: 0,
    leavesMarsOn: leavesOn,
    dayOf: (event) => rules.dayOf(event, mission, leavesOn),
    stillOnBoard: () => [],
    crewOnBoard: () => [],
    // The ascent vehicle carries the samples up to the rendezvous, and the orbiter from then on.
    cargoOnBoard: (event) => [
      (ascent(event.id) ? coming.ascent : coming.orbiter).name,
      cargo,
    ],
    healthInFlight: () => ({
      health: 0,
      diedOn: null,
      lost: [],
      saved: 0,
      savedByHabitat: 0,
    }),
    suppliesOutages: () => [],
    suppliesLeftOn: () => 0,
    aliveOn: () => [],
    stopWith: () => undefined,
    filledIn: (text) =>
      homewardText(text, "the samples", `the ${coming.orbiter.name}`),
    // Nothing aboard keeps a Service Life.
    shorten: () => undefined,
    cut: () => undefined,
    happened: (event) => ({
      kind: "missionEvent" as const,
      day: flight.dayOf(event),
      eventId: event.id,
    }),
  };
  return flight;
}

/** The Assets at Mars this Turn once those that flew samples home have left, each on the day it did. */
export function afterSamplesLeft(
  inService: AssetInService[],
  journey: SampleJourney | null,
): AssetInService[] {
  if (!journey) return inService;
  return inService.map((stay) => {
    const leftOn = journey.leftMars.get(operatingKey(stay.asset));
    return leftOn === undefined
      ? stay
      : { ...stay, untilDay: leftOn, failed: false, leftForHome: true };
  });
}
