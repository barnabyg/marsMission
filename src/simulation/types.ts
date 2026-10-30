export interface PlannedMission {
  launchVehicleId: string;
  assetIds: string[];
  /** The Reliability level bought for each Mission Event, by id. Any left out get the cheapest level. */
  reliability?: Record<string, string>;
}

export interface TurnPlan {
  /** The Turn's one Mission, or null to let the Turn pass without launching. */
  mission: PlannedMission | null;
}

export interface PlanCheck {
  costMillions: number;
  problems: string[];
}

interface OperatingAsset {
  assetId: string;
  name: string;
  kind: string;
  arrivedOn: string;
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
  operatingAssets: OperatingAsset[];
  launchVehicles: { id: string; name: string; costMillions: number }[];
  assets: { id: string; name: string; kind: string; costMillions: number }[];
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

export type TimelineEntry =
  MissionEventEntry | MilestoneEntry | FundingThresholdEntry;

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
  fundingPayouts: { publicSupport: number; payoutMillions: number }[];
  /** The Mission Event that ended this Turn's Mission and what that cost, if one failed. */
  failure: {
    missionEventName: string;
    assetsLost: string[];
    publicSupportLost: number;
  } | null;
  /** Why the Program was cancelled at the end of this Turn, if it was. */
  cancellationReason: string | null;
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
    /** The day a Mission Event failed and the journey stopped, if one did. */
    failedOnDay: number | null;
  } | null;
  /** The Assets already operating at Mars when the Turn began. */
  operatingAssetNames: string[];
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
