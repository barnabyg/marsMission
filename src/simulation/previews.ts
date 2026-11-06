import type { Raise } from "./benefits";

/** What a plan costs and weighs, and what's wrong with it, if anything. */
export interface PlanCheck {
  /** What the Mission costs, which is 0 with no Mission. */
  costMillions: number;
  /** What the Developments started this Turn cost, on top of the Mission's cost. */
  developmentCostMillions: number;
  /** What keeping the Assets at Mars that the plan doesn't end costs this Turn, on top of the rest. */
  upkeepMillions: number;
  /** What the Mission's Assets weigh, against what its Launch Vehicle can carry. */
  massTonnes: number;
  capacityTonnes: number;
  problems: string[];
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
  /** The samples it caches over a whole Turn in service, and the Science they earn once home, or null if it caches none. */
  cachesPerTurn: { samples: number; science: number } | null;
  /** The Benefit that earnsPerTurn is raised by, as long as the Assets giving it keep operating. Left out if none raises it. */
  raisedBy?: Raise;
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
  /** Whether it is on the way home from a round trip, on a later Turn, rather than on the way to Mars. */
  homeward: boolean;
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
