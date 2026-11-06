import type { Catalogue } from "../catalogue/catalogue";
import { crewNamesFor } from "./crew";
import {
  drainsInFlight,
  drainsWithoutSupplies,
  healthCourse,
  type HealthBlow,
  type HealthCourse,
  type HealthLost,
} from "./health";
import type { CrewLoss } from "./lostCrew";
import { protectionOf } from "./protection";
import {
  kilogramsOf,
  settleSupplies,
  suppliesCourse,
  suppliesOptionOf,
  type Outage,
  type SettledSupplies,
  type SuppliesUser,
} from "./supplies";
import type {
  Asset,
  LandingSite,
  MissionEvent,
  Rules,
  Trajectory,
} from "./rules";
import type {
  DecisionAnswers,
  DecisionPoint,
  Program,
  TurnPlan,
} from "./types";
import type { TurnSummary } from "./turnSummary";
import type {
  DecisionPointEntry,
  HazardEntry,
  MissionEventEntry,
  MissionReturnedEntry,
  SuppliesOutEntry,
} from "./timeline";

/** One Decision Point and how it was answered, with the Assets that came through it. */
type ContingencyUsed = Omit<TurnSummary["contingencies"][number], "assets"> & {
  saved: Asset[];
};

/** What happened to the Turn's Mission, if there was one, as far as the answers so far take it. */
export interface MissionOutcome {
  vehicleName: string | null;
  assets: Asset[];
  /** The Mission Events that happened, ending with the one that failed if one did. */
  entries: (
    | MissionEventEntry
    | DecisionPointEntry
    | HazardEntry
    | MissionReturnedEntry
    | SuppliesOutEntry
  )[];
  failedEvent: MissionEvent | undefined;
  /** The day of the failed Mission Event, if there was one. */
  failedOnDay: number | null;
  deliveredAssets: Asset[];
  /** The names of the Crew it delivered to Mars, which is none if it carried none or lost them on the way. */
  deliveredCrew: string[];
  /**
   * The return vehicle it carries, if it carries one: its name, the day it reaches Mars orbit if nothing goes wrong,
   * and whether it did, which it hasn't if the Mission failed or stopped at a Decision Point before then.
   */
  returnVehicle: { name: string; day: number; delivered: boolean } | null;
  /** The Crew it lost on the way, if it did, which costs Public Support as well as publicSupportLost. */
  crewLost: CrewLoss[];
  /** What hit the Crew's Health all at once on the way, such as a Contingency rescue, and who it hit. */
  crewBlows: (HealthBlow & { names: string[] })[];
  /**
   * The Health of each Crew member it carried, who wasn't lost with the Mission, as their flight ended: on arriving,
   * on getting home, at a Decision Point, or at 0 if it ran out on the way. Set once the Mission has flown.
   */
  crewHealth: {
    name: string;
    health: number;
    lost: HealthLost[];
    /** How much more radiation would have taken on the way with no Protection. */
    saved: number;
  }[];
  /** The Supplies, in kilograms, the Crew had left as their flight ended, which those who arrive bring with them. Set once the Mission has flown. */
  crewSuppliesKg: number;
  /** The day the Crew's Supplies ran out on the way, if they did. Set once the Mission has flown. */
  crewSuppliesOutOn: number | null;
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
  /** What a Free-return brought back, if it did, with the names of the Crew it brought home. */
  returned: {
    refundMillions: number;
    backOnDay: number;
    crew: string[];
  } | null;
  /** The first unanswered Decision Point, which the Mission stopped at. */
  decisionPoint: DecisionPoint | null;
  /** How each Decision Point was answered, in the order they came. */
  contingencies: ContingencyUsed[];
  /** The Service Life of each Asset that something on the way cut short, which is what's left after every cut. */
  cutServiceLife: Map<Asset, number>;
  /** The Hazard that lost the Mission, if one did. */
  lostTo: string | null;
  /** A landing held off for a dust storm, if one was: its Mission Event, and how long it waited. */
  heldLanding: { eventId: string; days: number } | null;
  goNoGo: TurnSummary["goNoGo"];
  /** The solar particle event the Mission met, if it did. */
  solarParticleEvent: {
    day: number;
    summary: TurnSummary["solarParticleEvent"];
  } | null;
}

/**
 * The Turn's Mission while it flies: what it carries and where it's going, the outcome so far, and what each subject
 * of the flight (Mission Events, Contingencies, go/no-go checks and solar particle events) needs to work its part out.
 */
export interface Flight {
  catalogue: Catalogue;
  rules: Rules;
  program: Program;
  mission: TurnPlan["mission"];
  answers: DecisionAnswers;
  assets: Asset[];
  /** The names of the Crew on board, which is none for a Robotic Mission. */
  crew: string[];
  /** By what share, in percent, the Crew's Protection slows radiation's harm. */
  radiationCutPercent: number;
  landingSite: LandingSite | undefined;
  freeReturn: Trajectory["freeReturn"];
  outcome: MissionOutcome;
  /** How long a landing has waited for a dust storm to pass, which moves it and everything after it on the way to Mars. */
  daysHeld: number;
  /**
   * The day of the Turn a journey home leaves Mars, on a Turn after the one its Crew arrived in, which Mission Events
   * timed from leaving Mars count from. Null in a Turn with no journey home.
   */
  leavesMarsOn: number | null;
  /** The day a Mission Event happens: on the way to Mars after any wait for a dust storm, or on the way home. */
  dayOf: (event: MissionEvent) => number;
  /** The Assets not yet delivered when this Mission Event is due. */
  stillOnBoard: (event: MissionEvent) => Asset[];
  /** The names of the Crew not yet delivered when this Mission Event is due, or on this day if it's a day, and still alive then. */
  crewOnBoard: (when: MissionEvent | number) => string[];
  /** The name of the return vehicle, if the Mission carries one that hasn't reached Mars orbit when this Mission Event is due. */
  returnVehicleOnBoard: (event: MissionEvent) => string[];
  /** What the flight has done to a Crew member's Health from launch to this day. */
  healthInFlight: (name: string, toDay: number) => HealthCourse;
  /** The days the Crew have had no Supplies left on board, if they keep flying to the end of the Turn. */
  suppliesOutages: () => Outage[];
  /** The Supplies, in kilograms, the Crew have left on board on this day. */
  suppliesLeftOn: (day: number) => number;
  /** Those of these Crew whose Health hasn't run out by this day. */
  aliveOn: (names: string[], day: number) => string[];
  /** Ends the Mission for what is still on board, so that only what was delivered before arrives. */
  stopWith: (onBoard: Asset[], crewOnBoard: string[]) => void;
  /** A Mission Event's or Contingency's text, with the Landing Site and what lands there filled in. */
  filledIn: (text: string) => string;
  /** Shortens the Service Life of each of these Assets, to no less than a day. */
  shorten: (onBoard: Asset[], to: (days: number) => number) => void;
  /** Shortens the Service Life of each of these Assets by this share. */
  cut: (onBoard: Asset[], percent: number) => void;
  /** The start of the Timeline entry for a Mission Event that happened. */
  happened: (event: MissionEvent) => {
    kind: "missionEvent";
    day: number;
    eventId: string;
  };
}

/**
 * The day this Mission delivers an Asset, or its Crew, which a landing held off for a dust storm moves later if it is
 * one of theirs.
 */
export function deliveryDayOf(
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "heldLanding">,
  delivered: { missionEvents: string[] },
): number {
  const { heldLanding } = flown;
  return (
    rules.deliveryDay(delivered, plan.mission) +
    (heldLanding && delivered.missionEvents.includes(heldLanding.eventId)
      ? heldLanding.days
      : 0)
  );
}

/** The day this Mission delivers its Crew, to Mars orbit or their Landing Site, after any wait for a dust storm. */
export function crewDeliveryDayOf(
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "heldLanding">,
): number {
  return deliveryDayOf(rules, plan, flown, rules.crewOf(plan.mission));
}

// Slow to create, and balance runs fly a great many Missions.
const listOfKinds = new Intl.ListFormat("en");

/**
 * What is landing, to start a sentence, such as "The rover", or "The lander and the Odyssey" with Crew. Always in the
 * Catalogue's order, whatever order the Mission lists them, with the Crew's ship last.
 */
function whatLands(
  catalogue: Catalogue,
  assets: Asset[],
  mission: TurnPlan["mission"],
): string {
  const kinds = catalogue.assets
    .filter((asset) => asset.landsAtSite && assets.includes(asset))
    .map(({ kind }) => `the ${kind}`);
  const crew = mission?.crew?.landsAtSite
    ? [`the ${catalogue.crew.vehicleName}`]
    : [];
  const named = listOfKinds.format(new Set([...kinds, ...crew]));
  return named.charAt(0).toUpperCase() + named.slice(1);
}

/** The outcome of a flight before anything has happened to it, with everything it carries to be delivered. */
export function outcomeBefore(
  vehicleName: string | null,
  assets: Asset[],
  crew: string[],
  landingSite: LandingSite | undefined,
): MissionOutcome {
  return {
    vehicleName,
    assets,
    entries: [],
    failedEvent: undefined,
    failedOnDay: null,
    deliveredAssets: assets,
    deliveredCrew: crew,
    returnVehicle: null,
    crewLost: [],
    crewBlows: [],
    crewHealth: [],
    crewSuppliesKg: 0,
    crewSuppliesOutOn: null,
    publicSupportLost: 0,
    landingSite,
    returned: null,
    decisionPoint: null,
    contingencies: [],
    cutServiceLife: new Map(),
    lostTo: null,
    solarParticleEvent: null,
    heldLanding: null,
    goNoGo: null,
  };
}

/**
 * The Turn's Mission on the launch pad, with nothing yet happened to it, and the day a journey home leaves Mars if the
 * Turn has one.
 */
export function startFlight(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  answers: DecisionAnswers,
  leavesMarsOn: number | null = null,
): Flight {
  const { mission } = plan;
  const vehicle = catalogue.launchVehicles.find(
    (candidate) => candidate.id === mission?.launchVehicleId,
  );
  const assets = (mission?.assetIds ?? []).flatMap((assetId) =>
    catalogue.assets.filter((candidate) => candidate.id === assetId),
  );
  const crew = crewNamesFor(catalogue, program, mission);
  const radiationCutPercent =
    protectionOf(catalogue, mission)?.radiationCutPercent ?? 0;
  const landingSite = rules.landingSiteById(mission?.landingSiteId);
  const outcome = outcomeBefore(
    vehicle?.name ?? null,
    assets,
    crew,
    landingSite,
  );
  const returnVehicle = mission?.returnVehicle
    ? catalogue.crew.returnVehicle
    : null;
  const returnVehicleDay =
    returnVehicle && rules.deliveryDay(returnVehicle, mission);
  if (returnVehicle && returnVehicleDay !== null) {
    outcome.returnVehicle = {
      name: returnVehicle.name,
      day: returnVehicleDay,
      delivered: true,
    };
  }
  const shorten = (onBoard: Asset[], to: (days: number) => number) => {
    for (const asset of onBoard) {
      const days =
        outcome.cutServiceLife.get(asset) ??
        rules.serviceLifeFor(mission, asset).days;
      outcome.cutServiceLife.set(asset, Math.max(1, Math.round(to(days))));
    }
  };
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const suppliesKg =
    crew.length > 0 ? kilogramsOf(suppliesOptionOf(catalogue, mission)) : 0;
  const blowsTo = (name: string) =>
    outcome.crewBlows.filter(({ names }) => names.includes(name));
  const healthWith = (name: string, toDay: number, outages: Outage[]) =>
    healthCourse(
      catalogue.crew.maxHealth,
      [
        ...drainsInFlight(catalogue, toDay, radiationCutPercent),
        ...drainsWithoutSupplies(catalogue, outages, 0, toDay),
      ],
      blowsTo(name),
    );
  // Health in flight is asked for often, and the Supplies change only with a new blow.
  let settledSoFar: {
    blows: number;
    supplies: SettledSupplies<SuppliesUser>;
  } | null = null;
  const settled = () => {
    if (settledSoFar?.blows !== outcome.crewBlows.length) {
      settledSoFar = {
        blows: outcome.crewBlows.length,
        supplies: settleSupplies(
          catalogue,
          { startKg: suppliesKg, refills: [] },
          turnDays,
          (outages) =>
            crew.map((name) => ({
              fromDay: 0,
              untilDay: healthWith(name, turnDays, outages).diedOn,
            })),
        ),
      };
    }
    return settledSoFar.supplies;
  };
  const flight: Flight = {
    catalogue,
    rules,
    program,
    mission,
    answers,
    assets,
    crew,
    radiationCutPercent,
    landingSite,
    freeReturn: rules.trajectoryFor(mission).freeReturn,
    outcome,
    daysHeld: 0,
    leavesMarsOn,
    dayOf: (event) =>
      event.timing.from === "leavingMars"
        ? rules.dayOf(event, mission, flight.leavesMarsOn)
        : rules.dayOf(event, mission) + flight.daysHeld,
    stillOnBoard: (event) =>
      assets.filter(
        (asset) =>
          rules.deliveryDay(asset, mission) >= rules.dayOf(event, mission),
      ),
    crewOnBoard: (when) => {
      const day = typeof when === "number" ? when : rules.dayOf(when, mission);
      const due = typeof when === "number" ? when + 1 : day;
      return rules.deliveryDay(rules.crewOf(mission), mission) >= due
        ? flight.aliveOn(crew, day)
        : [];
    },
    returnVehicleOnBoard: (event) =>
      returnVehicle &&
      returnVehicleDay !== null &&
      returnVehicleDay >= rules.dayOf(event, mission)
        ? [returnVehicle.name]
        : [],
    healthInFlight: (name, toDay) => healthWith(name, toDay, settled().outages),
    suppliesOutages: () => settled().outages,
    suppliesLeftOn: (day) =>
      suppliesCourse(catalogue, suppliesKg, settled().users, [], day).leftKg,
    aliveOn: (names, day) =>
      names.filter((name) => flight.healthInFlight(name, day).diedOn === null),
    stopWith: (onBoard, crewOnBoard) => {
      outcome.deliveredAssets = assets.filter(
        (asset) => !onBoard.includes(asset),
      );
      outcome.deliveredCrew = crew.filter(
        (name) => !crewOnBoard.includes(name),
      );
    },
    filledIn: (text) =>
      text
        .replaceAll("{site}", landingSite?.name ?? "")
        .replaceAll("{lander}", whatLands(catalogue, assets, mission)),
    shorten,
    cut: (onBoard, percent) => {
      shorten(onBoard, (days) => (days * (100 - percent)) / 100);
    },
    happened: (event) => ({
      kind: "missionEvent" as const,
      day: flight.dayOf(event),
      eventId: event.id,
    }),
  };
  return flight;
}
