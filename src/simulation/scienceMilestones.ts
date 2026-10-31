import type { Catalogue } from "../catalogue/catalogue";

type Milestone = Catalogue["milestones"][number];

/** A Milestone earned this Turn, on the day it was earned. */
export interface MilestoneAward {
  milestone: Milestone;
  day: number;
}

/** How Science or Public Support changes over a Turn. */
export interface TurnCurve {
  start: number;
  /** Amounts that come all at once on a day, and can be negative. */
  lumps: { day: number; amount: number }[];
  /** Amounts that build up evenly from one day to another, each ending exactly on its whole amount. */
  stints: { fromDay: number; toDay: number; amount: number }[];
}

// Shares of a stint are fractions, whose sum can land a tiny way below the whole number it should be.
const roundingAllowance = 1e-9;

function valueOn({ start, lumps, stints }: TurnCurve, day: number): number {
  let value = start;
  for (const lump of lumps) {
    if (lump.day <= day) value += lump.amount;
  }
  for (const { fromDay, toDay, amount } of stints) {
    const elapsed = Math.min(Math.max(day - fromDay, 0), toDay - fromDay);
    value += (amount * elapsed) / (toDay - fromDay);
  }
  return value;
}

/**
 * The day the curve reaches this level and stays there to the end of the Turn, or null if it ends the Turn below it.
 * A level reached only as the Turn ends counts on the Turn's last day, because the day after that is the next Turn's first.
 */
export function dayReached(
  curve: TurnCurve,
  level: number,
  turnDays: number,
): number | null {
  const isBelow = (day: number) =>
    valueOn(curve, day) < level - roundingAllowance;
  if (isBelow(turnDays)) return null;
  for (let day = turnDays - 1; day >= 0; day--) {
    if (isBelow(day)) return Math.min(day + 1, turnDays - 1);
  }
  return 0;
}

/**
 * Awards each Science Milestone that this Turn's Science reaches, earliest first. An award's own Science counts from its
 * day, so it can only reach another on that day or later, and each is awarded once. Those reached on one day go in the
 * Catalogue's order.
 */
export function awardScienceMilestones(
  catalogue: Catalogue,
  milestoneIds: string[],
  science: TurnCurve,
): MilestoneAward[] {
  const pending = catalogue.milestones.flatMap((milestone) =>
    "totalScience" in milestone.trigger && !milestoneIds.includes(milestone.id)
      ? [{ milestone, level: milestone.trigger.totalScience }]
      : [],
  );
  const awards: MilestoneAward[] = [];
  const curve = { ...science, lumps: [...science.lumps] };
  for (;;) {
    const reached = pending.flatMap(({ milestone, level }) => {
      const day = awards.some((award) => award.milestone === milestone)
        ? null
        : dayReached(curve, level, catalogue.program.launchWindowIntervalDays);
      return day === null ? [] : [{ milestone, day }];
    });
    const [first, ...others] = reached;
    if (!first) return awards;
    const next = others.reduce(
      (earliest, award) => (award.day < earliest.day ? award : earliest),
      first,
    );
    awards.push(next);
    curve.lumps.push({ day: next.day, amount: next.milestone.science });
  }
}
