import type { Catalogue } from "../catalogue/catalogue";
import {
  crewDeliveryDayOf,
  deliveryDayOf,
  type MissionOutcome,
} from "./flight";
import type { MilestoneAward } from "./scienceMilestones";
import type { LandingSite, Rules } from "./rules";
import type { FirstLandingEntry, MilestoneEntry } from "./timeline";
import type { Program, TurnPlan } from "./types";

/**
 * What the Turn's Mission earns by arriving: the Milestones for the first of each kind of Asset, the first landing,
 * the first Crew at Mars and the first Crew landing, and the Science for landing at a Landing Site for the first time.
 */

type Milestone = Catalogue["milestones"][number];

/** The day the Mission's Crew landed at its Landing Site, if they did. */
function crewLandedOn(
  rules: Rules,
  plan: TurnPlan,
  flown: MissionOutcome,
): number | null {
  return flown.deliveredCrew.length > 0 && plan.mission?.crew?.landsAtSite
    ? crewDeliveryDayOf(rules, plan, flown)
    : null;
}

/** Awards each Milestone that an Asset or the Crew delivered this Turn have earned for the first time. */
export function awardArrivalMilestones(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: MissionOutcome,
): MilestoneAward[] {
  const { deliveredAssets, deliveredCrew } = flown;
  const crewLanded = crewLandedOn(rules, plan, flown);
  /** The days on which what the Mission delivered earned it. */
  const earnedOn = ({ trigger }: Milestone): number[] => {
    if ("totalScience" in trigger) return [];
    if ("crewArrives" in trigger) {
      return deliveredCrew.length > 0
        ? [crewDeliveryDayOf(rules, plan, flown)]
        : [];
    }
    if ("crewLands" in trigger) return crewLanded === null ? [] : [crewLanded];
    return deliveredAssets
      .filter((asset) =>
        "assetLands" in trigger
          ? asset.landsAtSite === true
          : asset.kind === trigger.assetKindArrives,
      )
      .map((asset) => deliveryDayOf(rules, plan, flown, asset));
  };
  return catalogue.milestones
    .filter(
      (milestone) =>
        !program.milestoneIds.includes(milestone.id) &&
        earnedOn(milestone).length > 0,
    )
    .map((milestone) => ({ milestone, day: Math.min(...earnedOn(milestone)) }));
}

export function milestoneEntry({
  milestone,
  day,
}: MilestoneAward): MilestoneEntry {
  return {
    kind: "milestone",
    day,
    milestoneId: milestone.id,
    title: milestone.name,
    description: `${milestone.description} It awards ${milestone.science} Science and ${milestone.publicSupport} Public Support.`,
  };
}

/** The Science for landing at a Landing Site for the first time, if an Asset or the Crew did. */
export function creditFirstLanding(
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: MissionOutcome,
): { site: LandingSite; entry: FirstLandingEntry } | null {
  const crewLanded = crewLandedOn(rules, plan, flown);
  const landedOn = [
    ...flown.deliveredAssets
      .filter((asset) => asset.landsAtSite)
      .map((asset) => deliveryDayOf(rules, plan, flown, asset)),
    ...(crewLanded === null ? [] : [crewLanded]),
  ];
  const site = flown.landingSite;
  if (
    landedOn.length === 0 ||
    !site ||
    program.landedSiteIds.includes(site.id)
  ) {
    return null;
  }
  return {
    site,
    entry: {
      kind: "firstLanding",
      day: Math.min(...landedOn),
      title: `First landing at ${site.name}`,
      description: `${site.description} It earns ${site.science} Science.`,
    },
  };
}
