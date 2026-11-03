import type { Catalogue } from "../catalogue/catalogue";
import { crewNamesFor } from "./crew";
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
    MissionEventEntry | DecisionPointEntry | HazardEntry | MissionReturnedEntry
  )[];
  failedEvent: MissionEvent | undefined;
  /** The day of the failed Mission Event, if there was one. */
  failedOnDay: number | null;
  deliveredAssets: Asset[];
  /** The names of the Crew it delivered to Mars, which is none if it carried none or lost them on the way. */
  deliveredCrew: string[];
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
  /** What a Free-return brought back, if it did. */
  returned: { refundMillions: number; backOnDay: number } | null;
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
  landingSite: LandingSite | undefined;
  freeReturn: Trajectory["freeReturn"];
  outcome: MissionOutcome;
  /** How long a landing has waited for a dust storm to pass, which moves it and everything after it. */
  daysHeld: number;
  /** The day a Mission Event happens, after any wait for a dust storm. */
  dayOf: (event: MissionEvent) => number;
  /** The Assets not yet delivered when this Mission Event is due. */
  stillOnBoard: (event: MissionEvent) => Asset[];
  /** The names of the Crew not yet delivered when this Mission Event is due, or on this day if it's a day. */
  crewOnBoard: (when: MissionEvent | number) => string[];
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

// Slow to create, and balance runs fly a great many Missions.
const listOfKinds = new Intl.ListFormat("en");

/** What is landing, to start a sentence, such as "The rover". Always in the Catalogue's order, whatever order the Mission lists them. */
function whatLands(catalogue: Catalogue, assets: Asset[]): string {
  const kinds = catalogue.assets
    .filter((asset) => asset.landsAtSite && assets.includes(asset))
    .map(({ kind }) => `the ${kind}`);
  const named = listOfKinds.format(new Set(kinds));
  return named.charAt(0).toUpperCase() + named.slice(1);
}

/** The Turn's Mission on the launch pad, with nothing yet happened to it. */
export function startFlight(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  answers: DecisionAnswers,
): Flight {
  const { mission } = plan;
  const vehicle = catalogue.launchVehicles.find(
    (candidate) => candidate.id === mission?.launchVehicleId,
  );
  const assets = (mission?.assetIds ?? []).flatMap((assetId) =>
    catalogue.assets.filter((candidate) => candidate.id === assetId),
  );
  const crew = crewNamesFor(catalogue, program, mission);
  const landingSite = rules.landingSiteById(mission?.landingSiteId);
  const outcome: MissionOutcome = {
    vehicleName: vehicle?.name ?? null,
    assets,
    entries: [],
    failedEvent: undefined,
    failedOnDay: null,
    deliveredAssets: assets,
    deliveredCrew: crew,
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
  const shorten = (onBoard: Asset[], to: (days: number) => number) => {
    for (const asset of onBoard) {
      const days =
        outcome.cutServiceLife.get(asset) ??
        rules.serviceLifeFor(mission, asset).days;
      outcome.cutServiceLife.set(asset, Math.max(1, Math.round(to(days))));
    }
  };
  const flight: Flight = {
    catalogue,
    rules,
    program,
    mission,
    answers,
    assets,
    crew,
    landingSite,
    freeReturn: rules.trajectoryFor(mission).freeReturn,
    outcome,
    daysHeld: 0,
    dayOf: (event) => rules.dayOf(event, mission) + flight.daysHeld,
    stillOnBoard: (event) =>
      assets.filter(
        (asset) =>
          rules.deliveryDay(asset, mission) >= rules.dayOf(event, mission),
      ),
    crewOnBoard: (when) => {
      const due =
        typeof when === "number" ? when + 1 : rules.dayOf(when, mission);
      return rules.deliveryDay(catalogue.crew, mission) >= due ? crew : [];
    },
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
        .replaceAll("{lander}", whatLands(catalogue, assets)),
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
