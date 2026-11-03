import type { Raise } from "./benefits";
import type { TechnologyReadiness } from "./technologyReadiness";
import type { Timeline } from "./timeline";

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

export interface PlanCheck {
  /** What the Mission costs, which is 0 with no Mission. */
  costMillions: number;
  /** What the Developments started this Turn cost, on top of the Mission's cost. */
  developmentCostMillions: number;
  /** What the Mission's Assets weigh, against what its Launch Vehicle can carry. */
  massTonnes: number;
  capacityTonnes: number;
  problems: string[];
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

/** An Activity as Planning Mode offers it. */
export interface PlannedActivity {
  id: string;
  name: string;
  description: string;
  /** Whether doing this is a Survey. */
  surveys: boolean;
  /** What it earns over a whole Turn in service if it's research, or null if it isn't. */
  earnsPerTurn: {
    science: number;
    publicSupport: number;
    /** The Research Grant it pays for that Science. Zero if it pays none. */
    researchGrantMillions: number;
  } | null;
  /** The Benefit that earnsPerTurn is raised by, as long as the Assets giving it keep operating. Left out if none raises it. */
  raisedBy?: Raise;
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

/** A technology's Development as Planning Mode shows it. */
export interface PlannedDevelopment {
  /** The id of the Asset or Launch Vehicle, which is how a plan names it to start its Development. */
  id: string;
  name: string;
  costMillions: number;
  turns: number;
  status: "notStarted" | "inProgress" | "finished";
  /** How many Turns until it finishes, at the start of a Turn: all of them before it starts, and 0 once it has finished. */
  turnsLeft: number;
}

interface AwardedMilestone {
  name: string;
  science: number;
  publicSupport: number;
}

/** What one Asset earned by doing research during a Turn. */
export interface OngoingResearchEarned {
  assetName: string;
  activityName: string;
  science: number;
  publicSupport: number;
  /** How many days of the Turn it was in service. */
  days: number;
  /** What other Assets' Benefits added to it, which science and publicSupport include. Left out if they raised none of its days. */
  benefit?: {
    /** The Assets that gave the Benefit. */
    givenBy: string[];
    /** How many of its days were raised. */
    days: number;
    science: number;
    publicSupport: number;
  };
}

/** What changed over a Turn. */
export interface TurnSummary {
  missionCostMillions: number;
  /** What the Developments started this Turn cost, which moneyEndMillions takes off as well as the Mission's cost. */
  developmentCostMillions: number;
  moneyStartMillions: number;
  moneyEndMillions: number;
  scienceGained: number;
  publicSupportStart: number;
  publicSupportGained: number;
  publicSupportDrained: number;
  publicSupportEnd: number;
  milestones: AwardedMilestone[];
  /** The Science from landing at a Landing Site for the first time, if something did. */
  firstLanding: { siteName: string; science: number } | null;
  /** What each Asset doing research earned, which scienceGained and publicSupportGained include. */
  ongoingResearch: OngoingResearchEarned[];
  /** The Assets and Launch Vehicles that became Flight-proven this Turn. */
  technologiesProven: string[];
  /** The technologies whose Development started this Turn. */
  developmentsStarted: string[];
  /** The technologies whose Development finishes as the next Turn starts, which can then be chosen for a Mission. */
  developmentsFinished: string[];
  /** The Assets whose Service Life ended this Turn. */
  assetsEnded: string[];
  /** The Assets that failed in service this Turn, before their Service Life ended. */
  assetsFailed: string[];
  /** What this Turn's Survey found, if there was one and it changed anything. */
  survey: {
    siteNamesSurveyed: string[];
    siteNameRevealed: string | null;
  } | null;
  fundingPayouts: { publicSupport: number; payoutMillions: number }[];
  /** What each Asset's Ongoing Research paid in Research Grants, leaving out any that came to nothing. moneyEndMillions includes it. */
  researchGrants: { name: string; millions: number }[];
  researchGrantMillions: number;
  /** The Mission Event that ended this Turn's Mission and what that cost, if one failed. Assets delivered before it are safe. */
  failure: {
    missionEventName: string;
    assetsLost: string[];
    publicSupportLost: number;
    /** Whether a Free-return brought those Assets back to Earth. They aren't flown again. */
    returnedToEarth: boolean;
    /** The share of their cost that came back, which moneyEndMillions includes. */
    refundMillions: number;
    /** Whether a Hazard did it, which missionEventName then names, rather than a Mission Event. */
    hazard?: true;
  } | null;
  /** How each Decision Point in this Turn was answered, and what came of it. */
  contingencies: {
    missionEventName: string;
    contingencyName: string;
    answer: DecisionAnswer;
    rescued: boolean;
    /** The Assets it saved, with the Service Life each has left to start with. */
    assets: { name: string; serviceLifeDays: number }[];
  }[];
  /** The dust storms that had something at stake, how each was answered, and what came of it. */
  dustStorms: {
    siteName: string;
    days: number;
    answer: "shelter" | "carryOn";
    /** The Assets operating there when it started. */
    assets: string[];
    /** Those that failed because they carried on. assetsFailed lists them too. */
    assetsFailed: string[];
  }[];
  /** The solar particle event that hit the Mission, if one did, how it was answered and what came of it. */
  solarParticleEvent: {
    answer: "safeMode" | "carryOn";
    outcome: "protected" | "unharmed" | "damaged" | "lost";
    /** The Assets on board. */
    assets: string[];
    /** How much shorter it made each one's Service Life. */
    serviceLifeLossPercent: number;
  } | null;
  /** The go/no-go check before a landing in a dust storm, if there was one, and how it was answered. */
  goNoGo: {
    siteName: string;
    answer: "go" | "holdOff";
    /** How long the landing waited, which is 0 if it went ahead. */
    daysHeld: number;
    /** The Service Life each Asset being landed lost by waiting. */
    serviceLifeDaysLost: number;
  } | null;
  /** Why the Program was cancelled at the end of this Turn, if it was. */
  cancellationReason: string | null;
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
  summary: TurnSummary;
}

/** A Trajectory as Planning Mode offers it. */
export interface PlannedTrajectory {
  id: string;
  name: string;
  description: string;
  transferDays: number;
  costMillions: number;
  capacityLossTonnes: number;
  chosen: boolean;
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

/** An Asset on a planned Mission as Planning Mode shows it. */
export interface PlannedAsset {
  assetId: string;
  name: string;
  serviceLifeDays: number;
  serviceLifeOptions: { days: number; costMillions: number }[];
  reliabilityLevelId: string;
  activityId: string;
  activities: PlannedActivity[];
  /** The chance of failing in each Turn after it arrives, as a rough figure. */
  riskBand: string;
  reliabilityLevels: {
    id: string;
    name: string;
    costMillions: number;
    riskBand: string;
  }[];
}

/** A Mission Event as Planning Mode shows it: a rough risk band, never the exact probability. */
export interface PlannedMissionEvent {
  eventId: string;
  name: string;
  riskBand: string;
  reliabilityLevelId: string;
  reliabilityLevels: {
    id: string;
    name: string;
    costMillions: number;
    riskBand: string;
  }[];
  /** The Contingency on offer for this Mission Event, if it has one. */
  contingency: {
    id: string;
    name: string;
    description: string;
    costMillions: number;
    massTonnes: number;
    /** The chance that using it fails, as a rough figure. */
    riskBand: string;
    bought: boolean;
  } | null;
}
