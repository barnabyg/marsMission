import type { Catalogue } from "../catalogue/catalogue";
import type { CrewAtWork } from "./crewAtMars";
import type { MissionOutcome } from "./flight";
import { addDays } from "./rules";
import type { SuppliesOutEntry } from "./timeline";
import type { TurnSummary } from "./turnSummary";
import type { PlannedMission, Program } from "./types";

/**
 * Supplies: what Crew use up each day to stay alive. A Crewed Mission carries the Supplies chosen for it, which its
 * Crew use from launch, through any wait to land, and those left when they arrive join the store of the Crew already
 * in that place, which they all share. Each Crew member uses the Catalogue's amount for each day they are alive, so a
 * larger Crew uses them faster, and fewer Crew make them last longer. A store is kept in kilograms. Once it is empty,
 * Health falls quickly (`health.ts`), until more Crew arrive with Supplies of their own.
 */

type SuppliesOption = Catalogue["crew"]["supplies"]["options"][number];

/** Days on which a store of Supplies was empty while Crew were using it, from one day of the Turn to another. */
export interface Outage {
  fromDay: number;
  toDay: number;
}

/** Someone using a store of Supplies, from one day of the Turn until another, or to its end if null. */
export interface SuppliesUser {
  fromDay: number;
  untilDay: number | null;
}

/** What happened to a store of Supplies over a stretch of days. */
export interface SuppliesCourse {
  /** What is left at the end, in kilograms, which is never below zero. */
  leftKg: number;
  /** The stretches with none left, in order. */
  outages: Outage[];
}

// Kilograms such as 1.5 a day don't multiply exactly in floating point.
const tolerance = 1e-9;

/** The Supplies a Mission's Crew carry: those it chose, or else the least on offer. Undefined if the id isn't on offer. */
export function suppliesOptionOf(
  catalogue: Catalogue,
  mission: PlannedMission | null,
): SuppliesOption | undefined {
  const { options } = catalogue.crew.supplies;
  const chosen = mission?.crew?.suppliesId;
  return chosen === undefined
    ? options[0]
    : options.find(({ id }) => id === chosen);
}

/** How many kilograms of Supplies an option holds. */
export const kilogramsOf = (option: SuppliesOption | undefined): number =>
  option ? Math.round(option.massTonnes * 1000) : 0;

/** How many whole days this many kilograms last this many Crew, which is none if there are none to use them. */
export function daysOfSupplies(
  catalogue: Catalogue,
  kilograms: number,
  members: number,
): number {
  if (members === 0) return 0;
  const perDay = members * catalogue.crew.supplies.usePerMemberPerDayKg;
  return Math.floor(kilograms / perDay + tolerance);
}

/**
 * A store of Supplies that starts the stretch with `startKg`, gains `refills` on their days, and is used by each of
 * `users` for each day they are there, from day 0 to `toDay`. It runs out on the first day there isn't a whole day's
 * worth left, and stays empty until a refill.
 */
export function suppliesCourse(
  catalogue: Catalogue,
  startKg: number,
  users: readonly SuppliesUser[],
  refills: readonly { day: number; kg: number }[],
  toDay: number,
): SuppliesCourse {
  const { usePerMemberPerDayKg } = catalogue.crew.supplies;
  const days = [
    ...new Set([
      0,
      toDay,
      ...users.flatMap(({ fromDay, untilDay }) => [fromDay, untilDay ?? 0]),
      ...refills.map(({ day }) => day),
    ]),
  ]
    .filter((day) => day >= 0 && day <= toDay)
    .toSorted((first, second) => first - second);
  let kg = startKg;
  let outFrom: number | null = null;
  const outages: Outage[] = [];
  const endOutage = (day: number) => {
    if (outFrom !== null && outFrom < day) {
      outages.push({ fromDay: outFrom, toDay: day });
    }
    outFrom = null;
  };
  for (const [index, from] of days.entries()) {
    const to = days[index + 1];
    if (to === undefined) break;
    const refilled = refills
      .filter(({ day }) => day === from)
      .reduce((total, refill) => total + refill.kg, 0);
    kg += refilled;
    if (refilled > 0 && kg > tolerance) endOutage(from);
    const using = users.filter(
      ({ fromDay, untilDay }) =>
        fromDay <= from && (untilDay === null || untilDay > from),
    ).length;
    if (using === 0) continue;
    if (kg <= tolerance) {
      kg = 0;
      outFrom ??= from;
      continue;
    }
    const perDay = using * usePerMemberPerDayKg;
    const lasts = Math.ceil(kg / perDay - tolerance);
    if (from + lasts < to) {
      kg = 0;
      outFrom = from + lasts;
    } else {
      kg = Math.max(0, kg - perDay * (to - from));
    }
  }
  endOutage(toDay);
  return { leftKg: Math.round(kg * 1000) / 1000, outages };
}

/** Whether a Crew member who died on this day did so while their Supplies were out, rather than of Health alone. */
export const diedWithoutSupplies = (
  outages: readonly Outage[],
  diedOn: number,
): boolean =>
  outages.some(({ fromDay, toDay }) => fromDay < diedOn && diedOn <= toDay);

/** Whether two lists of outages are the same. */
export const sameOutages = (
  first: readonly Outage[],
  second: readonly Outage[],
): boolean =>
  first.length === second.length &&
  first.every(
    ({ fromDay, toDay }, index) =>
      second[index]?.fromDay === fromDay && second[index].toDay === toDay,
  );

/**
 * When Supplies ran out this Turn, on the way or in each place at Mars, for the events column and the Turn summary.
 * Crew who start a Turn with none left are told so again on its first day.
 */
export function suppliesRanOut(
  catalogue: Catalogue,
  program: Program,
  atWork: CrewAtWork[],
  flown: Pick<MissionOutcome, "crewSuppliesOutOn">,
): {
  entries: SuppliesOutEntry[];
  summary: TurnSummary["suppliesRanOut"];
} {
  const atMars = atWork.flatMap(({ name, locationName, supplies }) =>
    supplies.outages
      // Crew who arrive with none left ran out on the way, which has its own entry.
      .filter(
        ({ fromDay }) =>
          !supplies.refills.some(({ day, kg }) => day === fromDay && kg === 0),
      )
      .map(({ fromDay }) => {
        const none = fromDay === 0 && supplies.startKg === 0;
        const entry: SuppliesOutEntry = {
          kind: "suppliesOut",
          day: fromDay,
          title: none
            ? `No Supplies in ${locationName}`
            : `Supplies out in ${locationName}`,
          description: `The ${name} ${none ? "have no Supplies left" : "have run out of Supplies"}, so their Health falls quickly.`,
        };
        return { crew: name, day: fromDay, entry };
      }),
  );
  const onTheWay =
    flown.crewSuppliesOutOn === null
      ? []
      : [
          {
            crew: `Crew aboard the ${catalogue.crew.vehicleName}`,
            day: flown.crewSuppliesOutOn,
          },
        ];
  return {
    entries: atMars.map(({ entry }) => entry),
    summary: [...onTheWay, ...atMars]
      .toSorted((first, second) => first.day - second.day)
      .map(({ crew, day }) => ({ crew, on: addDays(program.date, day) })),
  };
}
