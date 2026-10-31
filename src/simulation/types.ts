export interface PlannedMission {
  launchVehicleId: string;
  assetIds: string[];
  /** The Reliability level bought for each Mission Event, by id. Any left out get the cheapest level. */
  reliability?: Record<string, string>;
  /** Where the Mission's lander comes down. Only a Mission carrying a lander has one. */
  landingSiteId?: string;
}

export interface TurnPlan {
  /** The Turn's one Mission, or null to let the Turn pass without launching. */
  mission: PlannedMission | null;
}

export interface PlanCheck {
  costMillions: number;
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
  /** The Landing Sites where a lander has already landed. */
  landedSiteIds: string[];
  /** The Landing Sites that can be chosen so far, in the order they became known. */
  knownLandingSiteIds: string[];
  /** The known Landing Sites at their lower, surveyed landing risk. */
  surveyedLandingSiteIds: string[];
  /** The Public Support levels of the Funding Thresholds already paid. */
  fundingThresholdsPaid: number[];
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
  operatingAssets: (OperatingAsset & { landingSiteName: string | null })[];
  launchVehicles: {
    id: string;
    name: string;
    costMillions: number;
    capacityTonnes: number;
  }[];
  assets: {
    id: string;
    name: string;
    kind: string;
    costMillions: number;
    massTonnes: number;
    landsAtSite: boolean;
  }[];
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
    /** Whether a lander has landed here, so that landing again earns no Science. */
    landed: boolean;
  }[];
}

export interface MissionEventEntry {
  kind: "missionEvent";
  day: number;
  eventId: string;
  title: string;
  description: string;
  outcome: "success" | "failure";
}

export interface MilestoneEntry {
  kind: "milestone";
  day: number;
  milestoneId: string;
  title: string;
  description: string;
}

export interface FundingThresholdEntry {
  kind: "fundingThreshold";
  day: number;
  title: string;
  description: string;
}

export interface FirstLandingEntry {
  kind: "firstLanding";
  day: number;
  title: string;
  description: string;
}

export interface SurveyEntry {
  kind: "survey";
  day: number;
  title: string;
  description: string;
}

export type TimelineEntry =
  | SurveyEntry
  | MissionEventEntry
  | MilestoneEntry
  | FundingThresholdEntry
  | FirstLandingEntry;

interface AwardedMilestone {
  name: string;
  science: number;
  publicSupport: number;
}

/** What changed over a Turn. */
export interface TurnSummary {
  missionCostMillions: number;
  moneyStartMillions: number;
  moneyEndMillions: number;
  scienceGained: number;
  publicSupportStart: number;
  publicSupportGained: number;
  publicSupportDrained: number;
  publicSupportEnd: number;
  milestones: AwardedMilestone[];
  /** The Science from landing at a Landing Site for the first time, if a lander did. */
  firstLanding: { siteName: string; science: number } | null;
  /** What this Turn's Survey found, if there was one and it changed anything. */
  survey: {
    siteNamesSurveyed: string[];
    siteNameRevealed: string | null;
  } | null;
  fundingPayouts: { publicSupport: number; payoutMillions: number }[];
  /** The Mission Event that ended this Turn's Mission and what that cost, if one failed. Assets delivered before it are safe. */
  failure: {
    missionEventName: string;
    assetsLost: string[];
    publicSupportLost: number;
  } | null;
  /** Why the Program was cancelled at the end of this Turn, if it was. */
  cancellationReason: string | null;
}

/** One Asset on this Turn's Mission and how its journey ended. */
export interface MissionAsset {
  name: string;
  /** The Landing Site it is heading for, if it's a lander. */
  landingSiteName: string | null;
  /** The day it was delivered, if it was. */
  deliveredOnDay: number | null;
  /** The day it was lost, if it was. */
  lostOnDay: number | null;
  /** Whether it was lost by crashing at its Landing Site. */
  crashed: boolean;
}

/** An Asset operating at Mars at some point in a Turn. */
export interface AssetAtMars {
  name: string;
  kind: string;
  /** Where it is on the surface, or null if it's in orbit. */
  landingSiteName: string | null;
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
}

/** What happened in a Turn, for Mission Mode to display. */
export interface Timeline {
  startDate: string;
  durationDays: number;
  /** The Mission launched this Turn, if any. */
  mission: {
    launchDay: number;
    arrivalDay: number;
    launchVehicleName: string;
    assetNames: string[];
    assets: MissionAsset[];
    /** The day a Mission Event failed and the journey stopped, if one did. */
    failedOnDay: number | null;
  } | null;
  /** Every Asset that operates at Mars during the Turn. */
  assetsAtMars: AssetAtMars[];
  entries: TimelineEntry[];
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
  summary: TurnSummary;
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
}
