import type { Catalogue } from "../catalogue/catalogue";
import { protectedFrom } from "./protection";
import type { Outage } from "./supplies";

/**
 * Crew Health: what lowers it, and when it runs out. Health is a whole number, from the Catalogue's maxHealth down to
 * 0. It falls steadily over stretches of days (`HealthDrain`), such as radiation on the way to Mars, and all at once on
 * a day (`HealthBlow`), such as a Contingency rescue. Each cause takes a whole point only once a whole point's worth has
 * built up over the stretch, so the same days always cost the same Health, and a Crew member dies on the first day the
 * points they have lost reach the Health they started the stretch with.
 *
 * Radiation is a cause of its own, in flight, in a solar particle event and at Mars, so Protection (`protection.ts`)
 * can slow just that, and having no Supplies left adds a faster drain of its own, in flight or at Mars, for the days
 * they are out (`supplies.ts`). What Protection saved is the radiation's harm over the same days without it. Time at
 * Mars is a cause of its own too, so that a habitat (`habitats.ts`) can slow just that, and what it saved is time at
 * Mars's harm over the same days without it.
 */

/** Why a Crew member lost Health. */
export type HealthLossCause =
  | "radiationInFlight"
  | "radiationAtMars"
  | "timeAtMars"
  | "contingency"
  | "solarParticleEvent"
  | "dustStorm"
  | "noSupplies";

/** The causes in the order the Turn summary lists them, with how the player reads each. */
export const healthLossCauses: Record<HealthLossCause, string> = {
  radiationInFlight: "radiation in flight",
  radiationAtMars: "radiation at Mars",
  timeAtMars: "time at Mars",
  contingency: "a Contingency rescue",
  solarParticleEvent: "a solar particle event",
  dustStorm: "a dust storm",
  noSupplies: "having no Supplies",
};

/** Health lost steadily, at so much a day, from one day of the Turn to another. */
export interface HealthDrain {
  cause: HealthLossCause;
  fromDay: number;
  toDay: number;
  perDay: number;
  /** What it would be with no Protection, if Protection slows it. */
  unprotectedPerDay?: number;
  /** What it would be with no habitat, if a habitat slows it. */
  withoutHabitatPerDay?: number;
}

/** Health lost all at once, on one day of the Turn. */
export interface HealthBlow {
  cause: HealthLossCause;
  day: number;
  health: number;
  /** What it would be with no Protection, if Protection lessens it. */
  unprotectedHealth?: number;
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
  /** How much more radiation would have taken over the same days with no Protection. */
  saved: number;
  /** How much more time at Mars would have taken over the same days with no habitat. */
  savedByHabitat: number;
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
  if (days.length === 0) {
    return {
      health: start,
      diedOn: null,
      lost: [],
      saved: 0,
      savedByHabitat: 0,
    };
  }
  const unprotected = {
    drains: drains.map((drain) => ({
      ...drain,
      perDay: drain.unprotectedPerDay ?? drain.perDay,
    })),
    blows: blows.map((blow) => ({
      ...blow,
      health: blow.unprotectedHealth ?? blow.health,
    })),
  };
  const savedBy = (day: number) =>
    totalOf(lostBy(unprotected.drains, unprotected.blows, day)) -
    totalOf(lostBy(drains, blows, day));
  const withoutHabitat = drains.map((drain) => ({
    ...drain,
    perDay: drain.withoutHabitatPerDay ?? drain.perDay,
  }));
  const savedByHabitatBy = (day: number) =>
    totalOf(lostBy(withoutHabitat, blows, day)) -
    totalOf(lostBy(drains, blows, day));
  let first = Math.min(...days);
  let last = Math.max(...days);
  const atEnd = lostBy(drains, blows, last);
  if (totalOf(atEnd) < start) {
    return {
      health: start - totalOf(atEnd),
      diedOn: null,
      lost: listed(atEnd, start),
      saved: savedBy(last),
      savedByHabitat: savedByHabitatBy(last),
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
    saved: savedBy(first),
    savedByHabitat: savedByHabitatBy(first),
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

/** Radiation at this rate, slowed by Protection that cuts its harm by this share. */
const radiation = (perDay: number, cutPercent: number) => ({
  perDay: protectedFrom(perDay, cutPercent),
  ...(cutPercent > 0 ? { unprotectedPerDay: perDay } : {}),
});

/**
 * Radiation on the way to Mars, or back, from launch, or leaving Mars, to this day, slowed by Protection that cuts its
 * harm by this share.
 */
export function drainsInFlight(
  catalogue: Catalogue,
  toDay: number,
  radiationCutPercent: number,
  fromDay = 0,
): HealthDrain[] {
  return [
    {
      cause: "radiationInFlight",
      fromDay,
      toDay,
      ...radiation(
        catalogue.crew.health.radiationPerDay.inFlight,
        radiationCutPercent,
      ),
    },
  ];
}

/** Days on which a habitat slows time at Mars's harm by a share, in percent. */
export interface HabitatDays {
  fromDay: number;
  toDay: number;
  cutPercent: number;
}

/**
 * Time at Mars over these days, split where the share a habitat slows it by changes. Habitats don't add up: on each
 * day the largest share applies.
 */
function timeAtMars(
  perDay: number,
  fromDay: number,
  toDay: number,
  housed: readonly HabitatDays[],
): HealthDrain[] {
  const days = [
    ...new Set([
      fromDay,
      toDay,
      ...housed.flatMap((each) => [each.fromDay, each.toDay]),
    ]),
  ]
    .filter((day) => day >= fromDay && day <= toDay)
    .toSorted((first, second) => first - second);
  return days.slice(0, -1).flatMap((from, index): HealthDrain[] => {
    const to = days[index + 1] ?? from;
    const cut = Math.max(
      0,
      ...housed
        .filter((each) => each.fromDay <= from && each.toDay >= to)
        .map(({ cutPercent }) => cutPercent),
    );
    return [
      {
        cause: "timeAtMars",
        fromDay: from,
        toDay: to,
        perDay: (perDay * (100 - cut)) / 100,
        ...(cut > 0 ? { withoutHabitatPerDay: perDay } : {}),
      },
    ];
  });
}

/**
 * Radiation and everything else that being at Mars does, over these days, with the radiation slowed by Protection
 * that cuts its harm by this share, and time at Mars slowed on the days a habitat houses them.
 */
export function drainsAtMars(
  catalogue: Catalogue,
  fromDay: number,
  toDay: number,
  radiationCutPercent: number,
  housed: readonly HabitatDays[] = [],
): HealthDrain[] {
  const { radiationPerDay, timeAtMarsPerDay } = catalogue.crew.health;
  return [
    {
      cause: "radiationAtMars",
      fromDay,
      toDay,
      ...radiation(radiationPerDay.atMars, radiationCutPercent),
    },
    ...(housed.length === 0
      ? [
          {
            cause: "timeAtMars" as const,
            fromDay,
            toDay,
            perDay: timeAtMarsPerDay,
          },
        ]
      : timeAtMars(timeAtMarsPerDay, fromDay, toDay, housed)),
  ];
}

/** Having no Supplies left, over the days of these outages that fall between `fromDay` and `toDay`. */
export function drainsWithoutSupplies(
  catalogue: Catalogue,
  outages: readonly Outage[],
  fromDay: number,
  toDay: number,
): HealthDrain[] {
  return outages.flatMap((outage) => {
    const from = Math.max(fromDay, outage.fromDay);
    const to = Math.min(toDay, outage.toDay);
    return to > from
      ? [
          {
            cause: "noSupplies" as const,
            fromDay: from,
            toDay: to,
            perDay: catalogue.crew.health.noSuppliesPerDay,
          },
        ]
      : [];
  });
}
