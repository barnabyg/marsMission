import type { Catalogue } from "../catalogue/catalogue";
import { arrivingCrewActivity } from "./crew";
import {
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  placeFor,
  type CrewMemberAtMars,
} from "./crewPlaces";
import { crewDeliveryDayOf, type MissionOutcome } from "./flight";
import {
  drainsAtMars,
  drainsWithoutSupplies,
  healthCourse,
  type HealthBlow,
  type HealthCourse,
} from "./health";
import { healthRanOut, type CrewLoss } from "./lostCrew";
import { protectionIdOf, radiationCutOf } from "./protection";
import { addDays, type Rules } from "./rules";
import { settleSupplies, type Outage } from "./supplies";
import type { PlaceAtMars, Program, TurnPlan } from "./types";

/** One Crew member's days at Mars in a Turn, which end early if their Health runs out, and what the days did to it. */
export interface CrewStay {
  member: CrewMemberAtMars;
  fromDay: number;
  untilDay: number | null;
  health: HealthCourse;
  /** What hit their Health all at once at Mars, such as being hurt in a dust storm. */
  blows: HealthBlow[];
  /** The days they shelter from a dust storm, when they do no work. */
  shelter?: { fromDay: number; toDay: number };
  /** The days the Supplies in their place are out, which lower their Health faster. */
  outages: Outage[];
}

/** The Crew operating in one place at Mars during a Turn, who share one Activity. */
export interface CrewAtWork {
  /** How a plan names the place. */
  key: string;
  place: PlaceAtMars;
  /** Where they are, as the player reads it, such as "Mars orbit" or a Landing Site's name. */
  locationName: string;
  /** How the Turn summary names them, such as "Crew in Mars orbit". */
  name: string;
  activityId: string;
  stays: CrewStay[];
  /** The Supplies they share: what they started the Turn with and gained, in kilograms, and what became of them. */
  supplies: {
    startKg: number;
    /** Supplies brought by Crew who arrive here this Turn, on the day they do. */
    refills: { day: number; kg: number }[];
    leftKg: number;
    outages: Outage[];
  };
}

/**
 * A Crew member's days at Mars from `fromDay` to the end of the Turn, with these blows to their Health and these days
 * without Supplies, and radiation slowed by their own Protection.
 */
function stayOf(
  catalogue: Catalogue,
  member: CrewMemberAtMars,
  fromDay: number,
  blows: HealthBlow[],
  outages: Outage[],
): Omit<CrewStay, "shelter"> {
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const health = healthCourse(
    member.health,
    [
      ...drainsAtMars(
        catalogue,
        fromDay,
        turnDays,
        radiationCutOf(catalogue, member.protectionId),
      ),
      ...drainsWithoutSupplies(catalogue, outages, fromDay, turnDays),
    ],
    blows,
  );
  return { member, fromDay, untilDay: health.diedOn, health, blows, outages };
}

/**
 * A Crew member's stay with one more blow to their Health, which can end it sooner. Fewer Crew make their place's
 * Supplies last longer, so `withSupplies` works the place out again once its stays have changed.
 */
export function hurt(
  catalogue: Catalogue,
  stay: CrewStay,
  blow: HealthBlow,
): CrewStay {
  return {
    ...stay,
    ...stayOf(
      catalogue,
      stay.member,
      stay.fromDay,
      [...stay.blows, blow],
      stay.outages,
    ),
  };
}

/**
 * The Crew in one place with their shared Supplies settled against their stays (`settleSupplies`), the same way as on
 * the way to Mars.
 */
export function withSupplies(
  catalogue: Catalogue,
  crew: CrewAtWork,
): CrewAtWork {
  const { startKg, refills } = crew.supplies;
  const { users, leftKg, outages } = settleSupplies(
    catalogue,
    crew.supplies,
    catalogue.program.launchWindowIntervalDays,
    (outagesSoFar) =>
      crew.stays.map((stay) => ({
        ...stay,
        ...stayOf(
          catalogue,
          stay.member,
          stay.fromDay,
          stay.blows,
          outagesSoFar,
        ),
      })),
  );
  return {
    ...crew,
    stays: users,
    supplies: { startKg, refills, leftKg, outages },
  };
}

/**
 * The Crew at Mars this Turn, by place: those already there, and any the Mission delivers, who arrive in Mars orbit or
 * at its Landing Site with the Health their flight left them, and take up the Activity of any Crew already there. Each
 * loses Health for every day at Mars, and dies on the day it runs out. Also what each place's Crew do from now on.
 * A dust storm can still change their stays (`dustStorms.ts`), before `crewAtTurnEnd` says who is left.
 */
export function crewAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: Pick<
    MissionOutcome,
    "deliveredCrew" | "crewHealth" | "heldLanding" | "crewSuppliesKg"
  >,
): {
  atWork: CrewAtWork[];
  arrived: CrewMemberAtMars[];
  crewActivities: Record<string, string>;
} {
  const arrivalDay = crewDeliveryDayOf(rules, plan, flown);
  const place = placeFor(plan.mission);
  const arrived = flown.deliveredCrew.map((name): CrewMemberAtMars => ({
    name,
    health:
      flown.crewHealth.find((member) => member.name === name)?.health ??
      catalogue.crew.maxHealth,
    arrivedOn: addDays(program.date, arrivalDay),
    location: place,
    protectionId: protectionIdOf(catalogue, plan.mission),
  }));
  const crewActivities = {
    ...program.crewActivities,
    ...plan.crewActivities,
  };
  if (arrived.length > 0) {
    crewActivities[crewKeyOf(place)] = arrivingCrewActivity(
      catalogue,
      rules,
      program,
      plan,
    ).id;
  }
  const stays: CrewStay[] = [
    ...crewAtMarsOf(program).map((member) =>
      stayOf(catalogue, member, 0, [], []),
    ),
    ...arrived.map((member) => stayOf(catalogue, member, arrivalDay, [], [])),
  ];
  const keys = [
    ...new Set(stays.map(({ member }) => crewKeyOf(member.location))),
  ];
  const atWork = keys.flatMap((key): CrewAtWork[] => {
    const here = stays.filter(
      ({ member }) => crewKeyOf(member.location) === key,
    );
    const where = here[0]?.member.location;
    if (!where) return [];
    const locationName = locationNameOf(rules, where);
    const arrivesHere = arrived.length > 0 && crewKeyOf(place) === key;
    return [
      withSupplies(catalogue, {
        key,
        place: where,
        locationName,
        name: `Crew in ${locationName}`,
        activityId: crewActivities[key] ?? "",
        stays: here,
        supplies: {
          startKg: program.crewSupplies[key] ?? 0,
          refills: arrivesHere
            ? [{ day: arrivalDay, kg: flown.crewSuppliesKg }]
            : [],
          leftKg: 0,
          outages: [],
        },
      }),
    ];
  });
  return { atWork, arrived, crewActivities };
}

/**
 * Who of the Crew at Mars is still there at the end of the Turn, with the Health they have left, and who died there
 * when their Health ran out: to their Supplies, if those were out that day, and otherwise to their Health. A place whose
 * Crew have all died drops out of what Crew do, and of the Supplies kept.
 */
export function crewAtTurnEnd(
  atWork: CrewAtWork[],
  crewActivities: Record<string, string>,
): {
  stillThere: CrewMemberAtMars[];
  deaths: CrewLoss[];
  crewActivities: Record<string, string>;
  crewSupplies: Record<string, number>;
} {
  const deaths = atWork.flatMap(({ stays: here, locationName, supplies }) => {
    const days = [
      ...new Set(here.flatMap(({ untilDay }) => untilDay ?? [])),
    ].toSorted((first, second) => first - second);
    return days.flatMap((day) =>
      healthRanOut(
        here
          .filter(({ untilDay }) => untilDay === day)
          .map(({ member }) => member.name),
        day,
        supplies.outages,
        `in ${locationName}`,
      ),
    );
  });
  // A place where every Crew member has died has no one left to do its Activity.
  const emptied = new Set(
    atWork
      .filter(({ stays: here }) =>
        here.every(({ untilDay }) => untilDay !== null),
      )
      .map(({ key }) => key),
  );
  return {
    stillThere: atWork.flatMap(({ stays: here }) =>
      here
        .filter(({ untilDay }) => untilDay === null)
        .map(({ member, health }) => ({ ...member, health: health.health })),
    ),
    deaths,
    crewActivities: Object.fromEntries(
      Object.entries(crewActivities).filter(([key]) => !emptied.has(key)),
    ),
    crewSupplies: Object.fromEntries(
      atWork
        .filter(({ key }) => !emptied.has(key))
        .map(({ key, supplies }) => [key, supplies.leftKg]),
    ),
  };
}
