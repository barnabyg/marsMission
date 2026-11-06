import type { AscentPropellantMade } from "./ascentPropellant";
import type { HealthLost } from "./health";
import type { CrewLossCause, DecisionAnswer } from "./types";

interface AwardedMilestone {
  name: string;
  /** A line about what the Program achieved, from the catalogue. */
  description: string;
  science: number;
  publicSupport: number;
}

/** What one Asset, or the Crew in one place, earned by doing research during a Turn. */
export interface OngoingResearchEarned {
  /** The Asset's name, or the Crew's, such as "Crew in Mars orbit". */
  assetName: string;
  activityName: string;
  science: number;
  publicSupport: number;
  /** How many days of the Turn it was in service, or the longest any of the Crew were. */
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
  /** What keeping the Assets at Mars going cost this Turn, which moneyEndMillions takes off too. */
  upkeepMillions: number;
  moneyStartMillions: number;
  moneyEndMillions: number;
  /** The Program's Science before the Turn, which scienceGained adds to. */
  scienceStart: number;
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
  /** Every Crew member at Mars as the Turn ends, with their Health, and whether they arrived this Turn. */
  crew: {
    name: string;
    locationName: string;
    health: number;
    maxHealth: number;
    arrived: boolean;
  }[];
  /**
   * The Crew lost this Turn, in the order they were lost, with why and the Public Support losing them cost, which
   * publicSupportEnd takes off as well as any failure's own loss.
   */
  crewLost: {
    names: string[];
    cause: CrewLossCause;
    /** Who was lost and how, such as "Ann Able was lost when Launch failed." */
    description: string;
    publicSupportLost: number;
  }[];
  /**
   * What each Crew member lost in Health this Turn and why, whether they are still at Mars, were lost or came home:
   * those already at Mars first, then those the Mission carried. Anyone who lost none is left out. For a Crew member who
   * died of it, it adds up to the Health they had. `savedByProtection` is how much more radiation would have taken
   * over the same days with no Protection, left out if it saved nothing.
   */
  healthLost: {
    name: string;
    lost: HealthLost[];
    savedByProtection?: number;
  }[];
  /** The Crew who came home to Earth safe this Turn, from a journey home or on a Free-return, who won't fly again. */
  crewHome: string[];
  /** The Public Support the Crew who came home earned, which publicSupportGained includes. */
  publicSupportForCrewHome: number;
  /**
   * The journey home flown this Turn, if one was: the round-trip Crew who left Mars, and the Mission Event that failed
   * on the way, losing them, if one did, with the Public Support it cost on top of losing them.
   */
  journeyHome: {
    crew: string[];
    failure: { missionEventName: string; publicSupportLost: number } | null;
  } | null;
  /**
   * When Supplies ran out this Turn, in order: aboard the Crewed Mission on its way, or for the Crew in a place at Mars,
   * such as "Crew in Mars orbit", including Crew who start the Turn with none left.
   */
  suppliesRanOut: { crew: string; on: string }[];
  /** The Assets whose Service Life ended this Turn. */
  assetsEnded: string[];
  /** The Assets that failed in service this Turn, before their Service Life ended. */
  assetsFailed: string[];
  /** What this Turn's Survey found, if there was one and it changed anything. */
  survey: {
    siteNamesSurveyed: string[];
    siteNameRevealed: string | null;
  } | null;
  /** The ascent propellant each Landing Site's fuel plants made this Turn, leaving out sites that made none. */
  ascentPropellant: AscentPropellantMade[];
  fundingPayouts: { publicSupport: number; payoutMillions: number }[];
  /** What each Asset's Ongoing Research paid in Research Grants, leaving out any that came to nothing. moneyEndMillions includes it. */
  researchGrants: { name: string; millions: number }[];
  researchGrantMillions: number;
  /** What the Program's backers paid as the Turn ended, for its Public Support as the Turn started. */
  baseFundingMillions: number;
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
    /** The Assets operating there when it started, then the Crew. */
    assets: string[];
    /** Those that failed because they carried on. assetsFailed lists them too. */
    assetsFailed: string[];
    /** The Crew hurt because they carried on, who each lost Health. healthLost lists it too. */
    crewHurt: string[];
  }[];
  /** The solar particle event that hit the Mission, if one did, how it was answered and what came of it. */
  solarParticleEvent: {
    answer: "safeMode" | "carryOn";
    outcome: "protected" | "unharmed" | "damaged" | "lost";
    /** The Assets on board. */
    assets: string[];
    /** How much shorter it made each one's Service Life. */
    serviceLifeLossPercent: number;
    /** The Crew on board, after the Assets. */
    crew: string[];
    /** The Health it cost each of them, after their Protection, which is 0 if it cost none or lost them. healthLost lists it too. */
    crewHealthLoss: number;
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
