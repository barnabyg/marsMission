export interface PlannedMission {
  launchVehicleId: string;
  assetIds: string[];
  /** The Reliability level bought for each Mission Event, by id. Any left out get the cheapest level. */
  reliability?: Record<string, string>;
  /** Where the Mission comes down. Only a Mission carrying an Asset that lands has one. */
  landingSiteId?: string;
  /** The choices made for each Asset, by id. Anything left out gets the shortest Service Life, the cheapest Reliability and the first Activity it lists. */
  assetChoices?: Record<string, AssetChoices>;
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
  /** How long after arrivedOn it stops operating. */
  serviceLifeDays: number;
  /** The Reliability level bought for it, which lowers its chance of failing in service. */
  reliabilityLevelId: string;
  /** What it does each Turn until the player changes it. */
  activityId: string;
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

export interface AssetEndedEntry {
  kind: "assetEnded";
  day: number;
  title: string;
  description: string;
}

export interface AssetFailedEntry {
  kind: "assetFailed";
  day: number;
  title: string;
  description: string;
}

export type TimelineEntry =
  | AssetFailedEntry
  | AssetEndedEntry
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

/** What one Asset earned by doing research during a Turn. */
export interface OngoingResearchEarned {
  assetName: string;
  activityName: string;
  science: number;
  publicSupport: number;
  /** How many days of the Turn it was in service. */
  days: number;
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
  /** The Science from landing at a Landing Site for the first time, if something did. */
  firstLanding: { siteName: string; science: number } | null;
  /** What each Asset doing research earned, which scienceGained and publicSupportGained include. */
  ongoingResearch: OngoingResearchEarned[];
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
  } | null;
  /** Why the Program was cancelled at the end of this Turn, if it was. */
  cancellationReason: string | null;
}

/** One Asset on this Turn's Mission and how its journey ended. */
export interface MissionAsset {
  name: string;
  kind: string;
  /** The Landing Site it is heading for, if it lands. */
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
  /** Names this Asset and no other, and stays the same from Turn to Turn. */
  key: string;
  name: string;
  kind: string;
  /** Where it is on the surface, or null if it's in orbit. */
  landingSiteName: string | null;
  activityName: string;
  /** How it gets about on the surface while doing its Activity. */
  surfaceMotion: "traverse" | "nearby" | "still";
  /** The day of the Turn it arrived, which is negative if that was in an earlier Turn. */
  arrivedOnDay: number;
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
  /** The day of the Turn it stops operating, or null if it lasts beyond the Turn. */
  untilDay: number | null;
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
  /** Where every Landing Site is, for showing Assets on the globe. */
  landingSites: { name: string; latitude: number; longitude: number }[];
  /** Every Asset that operates at Mars during the Turn. */
  assetsAtMars: AssetAtMars[];
  entries: TimelineEntry[];
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
  summary: TurnSummary;
}

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
}
