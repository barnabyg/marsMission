type HazardKind = "dustStorm" | "solarParticleEvent";

export interface MissionEventEntry {
  kind: "missionEvent";
  day: number;
  eventId: string;
  title: string;
  description: string;
  outcome: "success" | "failure";
  /** Whether this failure sends the Mission back to Earth rather than ending it where it is. */
  returningToEarth?: true;
}

/** A Mission on a Free-return Trajectory has got back to Earth. */
export interface MissionReturnedEntry {
  kind: "missionReturned";
  day: number;
  title: string;
  description: string;
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

/** A technology has been used successfully for the first time. */
export interface FlightProvenEntry {
  kind: "flightProven";
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

/** The player has a choice to make, because of a Mission Event or a Hazard. What they chose comes as the next entry. */
export interface DecisionPointEntry {
  kind: "decisionPoint";
  day: number;
  /** The Mission Event it's about, if it is about one. */
  eventId?: string;
  /** The Hazard it's about, if it is about one. */
  hazard?: HazardKind;
  /** The Landing Site it's about, if it is about one, which the surface view goes to. */
  siteName?: string;
  title: string;
  description: string;
}

/** A Hazard, or how the player's answer to one came out. */
export interface HazardEntry {
  kind: "hazard";
  hazard: HazardKind;
  day: number;
  title: string;
  description: string;
}

export type TimelineEntry =
  | DecisionPointEntry
  | HazardEntry
  | MissionReturnedEntry
  | AssetFailedEntry
  | AssetEndedEntry
  | SurveyEntry
  | FlightProvenEntry
  | MissionEventEntry
  | MilestoneEntry
  | FundingThresholdEntry
  | FirstLandingEntry;

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

/** How an Asset gets about on the surface while doing its Activity. */
export type SurfaceMotion = "traverse" | "nearby" | "still";

/** An Asset operating at Mars at some point in a Turn. */
export interface AssetAtMars {
  /** Names this Asset and no other, and stays the same from Turn to Turn. */
  key: string;
  name: string;
  kind: string;
  /** Where it is on the surface, or null if it's in orbit. */
  landingSiteName: string | null;
  activityName: string;
  surfaceMotion: SurfaceMotion;
  /** The day of the Turn it arrived, which is negative if that was in an earlier Turn. */
  arrivedOnDay: number;
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
  /** The day of the Turn it stops operating, or null if it lasts beyond the Turn. */
  untilDay: number | null;
  /** Its Service Life, if something on this Turn's Mission cut it short. */
  cutServiceLifeDays?: number;
}

/** What happened in a Turn, for Mission Mode to display. */
export interface Timeline {
  startDate: string;
  durationDays: number;
  /** The day of the Decision Point this Timeline stops at, or null if it runs to the end of the Turn. */
  decisionDay: number | null;
  /** The Mission launched this Turn, if any. */
  mission: {
    launchDay: number;
    arrivalDay: number;
    launchVehicleName: string;
    assetNames: string[];
    assets: MissionAsset[];
    /** The day a Mission Event failed and the journey stopped, if one did. */
    failedOnDay: number | null;
    /** The way back, if a Free-return is bringing it home. */
    returnsToEarth?: { fromDay: number; backOnDay: number };
    /** The day a solar particle event hit it, if one did. */
    solarParticleEventDay?: number;
  } | null;
  /** Where every Landing Site is, for showing Assets on the globe. */
  landingSites: { name: string; latitude: number; longitude: number }[];
  /** Every Asset that operates at Mars during the Turn. */
  assetsAtMars: AssetAtMars[];
  /** The dust storms over the Landing Sites known so far. Each is over by toDay. */
  dustStorms: { siteName: string; fromDay: number; toDay: number }[];
  entries: TimelineEntry[];
}
