import type { TechnologyReadiness } from "./technologyReadiness";
import type { Timeline } from "./timeline";
import type { PlannedActivity, PlannedDevelopment } from "./previews";
import type { TurnSummary } from "./turnSummary";

export interface PlannedMission {
  launchVehicleId: string;
  assetIds: string[];
  /** The Reliability level bought for each Mission Event, by id. Any left out get the cheapest level. */
  reliability?: Record<string, string>;
  /** Where the Mission comes down. Only a Mission carrying an Asset that lands has one. */
  landingSiteId?: string;
  /** The choices made for each Asset, by id. Anything left out gets the shortest Service Life, the cheapest Reliability and the first Activity it lists. */
  assetChoices?: Record<string, AssetChoices>;
  /** The Contingencies bought, by id. Each one covers one Mission Event that this Mission goes through. */
  contingencyIds?: string[];
  /** The Trajectory to Mars. Left out, it's the first the Catalogue lists. */
  trajectoryId?: string;
}

export interface AssetChoices {
  serviceLifeDays?: number;
  reliabilityLevelId?: string;
  /** What it does from the day it is delivered, until the player changes it. */
  activityId?: string;
}

export interface TurnPlan {
  /** The Turn's one Mission, or null to let the Turn pass without launching. */
  mission: PlannedMission | null;
  /** New Activities for Assets already operating, by their `key`. Any left out keep the one they have. */
  operatingActivities?: Record<string, string>;
  /** The technologies whose Development starts this Turn, by id. It is paid for in full this Turn, with or without a Mission. */
  developmentIds?: string[];
}

interface OperatingAsset {
  assetId: string;
  name: string;
  kind: string;
  arrivedOn: string;
  /** Where it is on the surface, or null if it's in orbit. */
  landingSiteId: string | null;
  /** How long after arrivedOn it stops operating. */
  serviceLifeDays: number;
  /** The Reliability level bought for it, which lowers its chance of failing in service. */
  reliabilityLevelId: string;
  /** What it does each Turn until the player changes it. */
  activityId: string;
  /** Whether it flew before its technology was Flight-proven, which raises its chance of failing in service for good. */
  flewUnproven: boolean;
}

type ProgramStatus =
  | { kind: "active" }
  | { kind: "retired" }
  | { kind: "cancelled"; reason: string };

/** Everything about a Program in progress, as plain data. Treat it as opaque and read it through the Simulation. */
export interface Program {
  seed: number;
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  science: number;
  milestoneIds: string[];
  /** The Landing Sites where something has already landed. */
  landedSiteIds: string[];
  /** The Landing Sites that can be chosen so far, in the order they became known. */
  knownLandingSiteIds: string[];
  /** The known Landing Sites at their lower, surveyed landing risk. */
  surveyedLandingSiteIds: string[];
  /** The Public Support levels of the Funding Thresholds already paid. */
  fundingThresholdsPaid: number[];
  /** The Assets and Launch Vehicles this Program has made Flight-proven by using them successfully. Those the Catalogue starts Flight-proven aren't listed. */
  provenTechnologyIds: string[];
  /** The Developments started, each with the Turn at whose start it finishes. One that has finished stays listed. */
  developments: { technologyId: string; finishesOnTurn: number }[];
  operatingAssets: OperatingAsset[];
  status: ProgramStatus;
}

export interface ProgramView {
  status: ProgramStatus;
  cancellationLevel: number;
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  science: number;
  milestones: { id: string; name: string }[];
  nextFundingThreshold: {
    publicSupport: number;
    payoutMillions: number;
    pointsAway: number;
  } | null;
  operatingAssets: (OperatingAsset & {
    /** How a plan names this Asset to change its Activity. */
    key: string;
    activityName: string;
    /** The Activities it can do, which is none if it has left the catalogue. */
    activities: PlannedActivity[];
    landingSiteName: string | null;
    /** How many days of Service Life are left, which is 0 if it ends as the coming Turn starts. */
    daysLeft: number;
  })[];
  launchVehicles: {
    id: string;
    name: string;
    /** What it costs now, which is more until it is Flight-proven. */
    costMillions: number;
    capacityTonnes: number;
    technologyReadiness: TechnologyReadiness;
  }[];
  assets: {
    id: string;
    name: string;
    kind: string;
    /** What it costs now, which is more until it is Flight-proven. */
    costMillions: number;
    massTonnes: number;
    landsAtSite: boolean;
    technologyReadiness: TechnologyReadiness;
    /** What it does for other Assets while it operates at Mars, or null if it gives no Benefit. */
    benefit: string | null;
  }[];
  /** Each technology that needs Development before it can fly, Launch Vehicles first, whether or not it has started. */
  developments: PlannedDevelopment[];
  /** Whether a Survey would still lower a landing risk or reveal a Landing Site. */
  somethingLeftToSurvey: boolean;
  /** The Landing Sites the player can choose. */
  landingSites: {
    id: string;
    name: string;
    description: string;
    science: number;
    /** Whether a Survey has lowered this site's landing risk. */
    surveyed: boolean;
    /** The site's landing risk with no Reliability, as a rough figure. */
    riskBand: string;
    /** Whether anything has landed here, so that landing again earns no Science. */
    landed: boolean;
  }[];
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
  summary: TurnSummary;
}

export type DecisionAnswer =
  "use" | "decline" | "shelter" | "carryOn" | "safeMode" | "go" | "holdOff";

/** The answers to a Turn's Decision Points so far, by each one's `id`. */
export type DecisionAnswers = Readonly<Record<string, DecisionAnswer>>;

/** A choice the player must make before the Turn can go on. There is no time limit. */
export interface DecisionPoint {
  /** How the answers name this one. */
  id: string;
  kind: "contingency" | "dustStorm" | "solarParticleEvent" | "goNoGo";
  day: number;
  /** What it's about, such as a Mission Event or a Hazard. */
  title: string;
  description: string;
  /** The Assets at stake. */
  assets: string[];
  /** The Landing Site it's about, if it is about one. */
  siteName?: string;
  /** What the player can do. */
  choices: [DecisionChoice, DecisionChoice];
}

interface DecisionChoice {
  answer: DecisionAnswer;
  label: string;
  /** The chance of it going wrong as a rough figure, or null if no roll depends on it. */
  riskBand: string | null;
  description: string;
}

/** A Turn worked out as far as it can go: to its end, or to the first Decision Point with no answer yet. */
export type TurnProgress =
  | { decisionPoint: null; timeline: Timeline; result: TurnResult }
  | { decisionPoint: DecisionPoint; timeline: Timeline };
