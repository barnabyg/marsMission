import type { CrewStyle } from "./crewPlay";
import type { DecisionAnswer, ProgramView } from "../simulation/simulation";

/* The choices a play style makes, which `playStyle` in playStyle.ts turns into a strategy. */

export type Aim = "science" | "grants";

/** A strategy that launches one Mission with one Asset on every Turn that it can, up to any limit of Assets. */
export interface PlayStyle {
  /** The kinds of Asset to try sending this Turn, best first. */
  order(view: ProgramView): string[];
  /** Assets, by id, to send in place of the first of their kind, whether or not they are Flight-proven yet, when it can afford them. */
  prefers?: string[] | ((view: ProgramView) => string[]);
  /** What Assets on the surface and orbiters doing research aim for, which can change as the Program goes on. */
  aim: Aim | ((view: ProgramView) => Aim);
  /**
   * A Launch Vehicle, by id, to fly once it is built, carrying one more Asset of each other kind it would send this
   * Turn, as many as fit and it can afford, in place of a Mission with one Asset on the cheapest that can carry it.
   */
  fillsVehicle?: string;
  /** Fills that Launch Vehicle only while this is true. */
  fillsWhile?: (view: ProgramView) => boolean;
  /** Technologies, by id, whose Development it starts as soon as it can afford it on top of the Turn's Mission, keeping any reserve. */
  develops?: string[];
  /** Starts that Development only while this is true. */
  developsWhile?: (view: ProgramView) => boolean;
  /** Sends a Crewed Mission, of the largest Crew it can afford, before any Asset, whenever one can fly, as this says. */
  fliesCrew?: CrewStyle;
  /** Whether an Asset that can Survey does that first, while there is something left to Survey. */
  surveysFirst: boolean;
  /** Stops Surveying sooner than when nothing is left to Survey, once this is no longer true. */
  surveysWhile?: (view: ProgramView) => boolean;
  /** Whether a lander only goes to a site that a Survey has made safer. */
  onlySurveyedSites: boolean;
  /** Buys the longest Service Life it can afford, rather than the shortest, on every Asset or these kinds. */
  longestServiceLife?: boolean | string[];
  /** Buys Reliability for the Asset: the best it can afford, or only the cheapest level there is above none. */
  assetReliability?: "best" | "cheapest";
  /** Buys that Reliability only for these kinds of Asset, rather than for every Asset. */
  assetReliabilityFor?: string[];
  /** Buys the best Reliability on every Mission Event it can afford, rather than none. */
  missionEventReliability?: boolean;
  /** Launches only while fewer than this many Assets are operating. */
  assetLimit?: number;
  /** Keeps this much for a retry whenever an Asset is already operating, until Research Grants would pay for one. */
  reserveMillions?: number;
  /** Launches nothing after this Turn. */
  lastLaunchTurn?: number;
  /** Buys every Contingency this Mission can have and afford, and what it does when one could be used. */
  contingencies?: DecisionAnswer;
  /** Buys those Contingencies only while this is true. */
  contingenciesWhile?: (view: ProgramView) => boolean;
  /** The Trajectory it flies, when a Mission can have it and afford it. */
  trajectory?: string;
  /** Flies that Trajectory only while this is true. */
  trajectoryWhile?: (view: ProgramView) => boolean;
  /** What it does at a dust storm, which is to shelter unless it says otherwise. */
  dustStorms?: "shelter" | "carryOn";
  /** What it does at a solar particle event, which is safe mode unless it says otherwise. */
  solarParticleEvents?: "safeMode" | "carryOn";
  /** What it does at a go/no-go check before a landing, which is to hold off unless it says otherwise. */
  goNoGo?: "go" | "holdOff";
}
