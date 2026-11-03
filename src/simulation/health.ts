import type { Catalogue } from "../catalogue/catalogue";

/**
 * Crew Health: what lowers it, and when it runs out. Health is a whole number, from the Catalogue's maxHealth down to
 * 0. It falls steadily over stretches of days (`HealthDrain`), such as radiation on the way to Mars, and all at once on
 * a day (`HealthBlow`), such as a Contingency rescue. Each cause takes a whole point only once a whole point's worth has
 * built up over the stretch, so the same days always cost the same Health, and a Crew member dies on the first day the
 * points they have lost reach the Health they started the stretch with.
 *
 * Radiation is a cause of its own, in flight and at Mars, so Protection can slow just that, and a drain from Supplies
 * running out can join the others at Mars from the day they do.
 */

/** Why a Crew member lost Health. */
export type HealthLossCause =
  | "radiationInFlight"
  | "radiationAtMars"
  | "timeAtMars"
  | "contingency"
  | "dustStorm";

/** The causes in the order the Turn summary lists them, with how the player reads each. */
export const healthLossCauses: Record<HealthLossCause, string> = {
  radiationInFlight: "radiation in flight",
  radiationAtMars: "radiation at Mars",
  timeAtMars: "time at Mars",
  contingency: "a Contingency rescue",
  dustStorm: "a dust storm",
};

/** Health lost steadily, at so much a day, from one day of the Turn to another. */
export interface HealthDrain {
  cause: HealthLossCause;
  fromDay: number;
  toDay: number;
  perDay: number;
}

/** Health lost all at once, on one day of the Turn. */
export interface HealthBlow {
  cause: HealthLossCause;
  day: number;
  health: number;
}

/** What one cause cost a Crew member in Health. */
export interface HealthLost {
  cause: HealthLossCause;
  health: number;
}

/** What a stretch of days did to one Crew member's Health. */
export interface HealthCourse {
  /** Their Health at the end, which is 0 if they died. */
  health: number;
  /** The day their Health ran out, or null if it didn't. */
  diedOn: number | null;
  /** What each cause took, in the Turn summary's order, leaving out those that took nothing. Up to their death, it adds up to their Health at the start. */
  lost: HealthLost[];
}

const causeOrder = Object.keys(healthLossCauses) as HealthLossCause[];

// Rates such as 0.05 a day don't multiply exactly in floating point, so 580 days of one could come to 28.999…
const wholePoints = (health: number) => Math.floor(health + 1e-9);

/** What each cause has taken by this day, in whole points. */
function lostBy(
  drains: readonly HealthDrain[],
  blows: readonly HealthBlow[],
  day: number,
): Map<HealthLossCause, number> {
  const exact = new Map<HealthLossCause, number>();
  const add = (cause: HealthLossCause, health: number) =>
    exact.set(cause, (exact.get(cause) ?? 0) + health);
  for (const { cause, fromDay, toDay, perDay } of drains) {
    add(cause, perDay * Math.max(0, Math.min(day, toDay) - fromDay));
  }
  const whole = new Map(
    [...exact].map(([cause, health]) => [cause, wholePoints(health)]),
  );
  for (const blow of blows) {
    if (blow.day <= day) {
      whole.set(blow.cause, (whole.get(blow.cause) ?? 0) + blow.health);
    }
  }
  return whole;
}

const totalOf = (lost: Map<HealthLossCause, number>) =>
  [...lost.values()].reduce((total, health) => total + health, 0);

/** The causes that took something, in order, with those listed last trimmed so that together they take no more than `upTo`. */
function listed(lost: Map<HealthLossCause, number>, upTo: number) {
  let left = upTo;
  const each = causeOrder.map((cause) => {
    const health = Math.min(lost.get(cause) ?? 0, left);
    left -= health;
    return { cause, health };
  });
  return each.filter(({ health }) => health > 0);
}

/** What these drains and blows do to a Crew member who starts with this much Health, until the last of them ends. */
export function healthCourse(
  start: number,
  drains: readonly HealthDrain[],
  blows: readonly HealthBlow[],
): HealthCourse {
  const days = [
    ...drains.flatMap(({ fromDay, toDay }) => [fromDay, toDay]),
    ...blows.map(({ day }) => day),
  ];
  if (days.length === 0) return { health: start, diedOn: null, lost: [] };
  let first = Math.min(...days);
  let last = Math.max(...days);
  const atEnd = lostBy(drains, blows, last);
  if (totalOf(atEnd) < start) {
    return {
      health: start - totalOf(atEnd),
      diedOn: null,
      lost: listed(atEnd, start),
    };
  }
  // Health only ever falls, so the first day it runs out can be searched for.
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    if (totalOf(lostBy(drains, blows, middle)) >= start) last = middle;
    else first = middle + 1;
  }
  return {
    health: 0,
    diedOn: first,
    lost: listed(lostBy(drains, blows, first), start),
  };
}

/** Adds up what each cause took over two stretches, in the Turn summary's order. */
export function bothLost(
  earlier: readonly HealthLost[],
  later: readonly HealthLost[],
): HealthLost[] {
  return causeOrder.flatMap((cause) => {
    const health = [...earlier, ...later]
      .filter((lost) => lost.cause === cause)
      .reduce((total, lost) => total + lost.health, 0);
    return health > 0 ? [{ cause, health }] : [];
  });
}

/** Radiation on the way to Mars, or back, from launch to this day. Protection will slow it. */
export function drainsInFlight(
  catalogue: Catalogue,
  toDay: number,
): HealthDrain[] {
  return [
    {
      cause: "radiationInFlight",
      fromDay: 0,
      toDay,
      perDay: catalogue.crew.health.radiationPerDay.inFlight,
    },
  ];
}

/** Radiation and everything else that being at Mars does, over these days. Protection will slow the radiation. */
export function drainsAtMars(
  catalogue: Catalogue,
  fromDay: number,
  toDay: number,
): HealthDrain[] {
  const { radiationPerDay, timeAtMarsPerDay } = catalogue.crew.health;
  return [
    {
      cause: "radiationAtMars",
      fromDay,
      toDay,
      perDay: radiationPerDay.atMars,
    },
    { cause: "timeAtMars", fromDay, toDay, perDay: timeAtMarsPerDay },
  ];
}
