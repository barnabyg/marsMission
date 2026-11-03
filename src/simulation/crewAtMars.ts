import type { Catalogue } from "../catalogue/catalogue";
import {
  arrivingCrewActivity,
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  marsOrbit,
  type CrewMemberAtMars,
} from "./crew";
import type { MissionOutcome } from "./flight";
import {
  bothLost,
  drainsAtMars,
  healthCourse,
  type HealthCourse,
} from "./health";
import { crewLoss, type CrewLoss } from "./lostCrew";
import { addDays, daysBetween, type Rules } from "./rules";
import type { AssetAtMars, CrewArrivedEntry, MissionAsset } from "./timeline";
import type { TurnSummary } from "./turnSummary";
import type { Program, TurnPlan } from "./types";

/** The Crew operating in one place at Mars during a Turn, who share one Activity. */
export interface CrewAtWork {
  /** How a plan names the place. */
  key: string;
  /** How the Turn summary names them, such as "Crew in Mars orbit". */
  name: string;
  activityId: string;
  /** Each Crew member's days there in this Turn, which end early if their Health runs out, and what the days did to it. */
  stays: {
    member: CrewMemberAtMars;
    fromDay: number;
    untilDay: number | null;
    health: HealthCourse;
  }[];
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** The day of the Turn the Mission delivers its Crew, if it carried any. */
const arrivalDayOf = (catalogue: Catalogue, rules: Rules, plan: TurnPlan) =>
  rules.deliveryDay(catalogue.crew, plan.mission);

/**
 * The Crew at Mars this Turn: those already there, and any the Mission delivers, who arrive in Mars orbit with the
 * Health their flight left them and take up the Activity of any Crew already there. Each loses Health for every day
 * at Mars, and dies on the day it runs out. Also what each place's Crew do from now on, and each one's new record.
 */
export function crewAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "deliveredCrew" | "crewHealth">,
): {
  atWork: CrewAtWork[];
  arrived: CrewMemberAtMars[];
  /** Those at Mars at the end of the Turn, with the Health they have left. */
  stillThere: CrewMemberAtMars[];
  /** Those whose Health ran out at Mars. */
  deaths: CrewLoss[];
  crewActivities: Record<string, string>;
} {
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const arrivalDay = arrivalDayOf(catalogue, rules, plan);
  const arrived = flown.deliveredCrew.map((name): CrewMemberAtMars => ({
    name,
    health:
      flown.crewHealth.find((member) => member.name === name)?.health ??
      catalogue.crew.maxHealth,
    arrivedOn: addDays(program.date, arrivalDay),
    location: marsOrbit,
  }));
  const crewActivities = {
    ...program.crewActivities,
    ...plan.crewActivities,
  };
  if (arrived.length > 0) {
    crewActivities[crewKeyOf(marsOrbit)] = arrivingCrewActivity(
      catalogue,
      rules,
      program,
      plan,
    ).id;
  }
  const stays = [
    ...crewAtMarsOf(program).map((member) => ({ member, fromDay: 0 })),
    ...arrived.map((member) => ({ member, fromDay: arrivalDay })),
  ].map(({ member, fromDay }) => {
    const health = healthCourse(
      member.health,
      drainsAtMars(catalogue, fromDay, turnDays),
      [],
    );
    return { member, fromDay, untilDay: health.diedOn, health };
  });
  const keys = [
    ...new Set(stays.map(({ member }) => crewKeyOf(member.location))),
  ];
  const atWork = keys.map((key): CrewAtWork => {
    const here = stays.filter(
      ({ member }) => crewKeyOf(member.location) === key,
    );
    const location = here[0]?.member.location ?? marsOrbit;
    return {
      key,
      name: `Crew in ${locationNameOf(location)}`,
      activityId: crewActivities[key] ?? "",
      stays: here,
    };
  });
  const deaths = atWork.flatMap(({ stays: here }) => {
    const days = [
      ...new Set(here.flatMap(({ untilDay }) => untilDay ?? [])),
    ].toSorted((first, second) => first - second);
    return days.flatMap((day) => {
      const dying = here.filter(({ untilDay }) => untilDay === day);
      return crewLoss(
        dying.map(({ member }) => member.name),
        day,
        "health",
        `in ${locationNameOf(dying[0]?.member.location ?? marsOrbit)}, when their Health ran out`,
      );
    });
  });
  // A place where every Crew member has died has no one left to do its Activity.
  const emptied = new Set(
    atWork
      .filter(({ stays: here }) =>
        here.every(({ untilDay }) => untilDay !== null),
      )
      .map(({ key }) => key),
  );
  const stillThere = stays
    .filter(({ untilDay }) => untilDay === null)
    .map(({ member, health }) => ({ ...member, health: health.health }));
  return {
    atWork,
    arrived,
    stillThere,
    deaths,
    crewActivities: Object.fromEntries(
      Object.entries(crewActivities).filter(([key]) => !emptied.has(key)),
    ),
  };
}

/**
 * What each Crew member lost in Health this Turn and why, whatever became of them: first those already at Mars, then
 * those the Mission carried, with what they lost at Mars after what they lost on the way. Anyone who lost none is left out.
 */
export function healthLostSummary(
  atWork: CrewAtWork[],
  flown: Pick<MissionOutcome, "crewHealth">,
): TurnSummary["healthLost"] {
  const stays = atWork.flatMap(({ stays: here }) => here);
  const atMars = (name: string) =>
    stays.find(({ member }) => member.name === name)?.health.lost ?? [];
  const flownNames = new Set(flown.crewHealth.map(({ name }) => name));
  return [
    ...stays
      .filter(({ member }) => !flownNames.has(member.name))
      .map(({ member, health }) => ({ name: member.name, lost: health.lost })),
    ...flown.crewHealth.map(({ name, lost }) => ({
      name,
      lost: bothLost(lost, atMars(name)),
    })),
  ].filter(({ lost }) => lost.length > 0);
}

/** The events column's entry for the Crew arriving, if they did. */
export function crewArrivedEntry(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  arrived: CrewMemberAtMars[],
  crewActivities: Record<string, string>,
): CrewArrivedEntry[] {
  const [first] = arrived;
  if (!first) return [];
  const where = locationNameOf(first.location);
  const activityId = crewActivities[crewKeyOf(first.location)] ?? "";
  const doing = rules.activityById(activityId);
  return [
    {
      kind: "crewArrived",
      day: arrivalDayOf(catalogue, rules, plan),
      title: `Crew in ${where}`,
      description: `${listOfNames.format(arrived.map(({ name }) => name))} have arrived in ${where} aboard the ${catalogue.crew.vehicleName}, and ${
        doing?.effect.kind === "research" ? `start ${doing.name}` : "rest"
      }.`,
    },
  ];
}

/** The Crewed Mission's ship as Mission Mode shows it on its way, if the Mission carried Crew. */
export function crewShipOnMission(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "deliveredCrew" | "failedOnDay">,
): MissionAsset[] {
  if (!plan.mission?.crew) return [];
  const delivered = flown.deliveredCrew.length > 0;
  return [
    {
      name: catalogue.crew.vehicleName,
      kind: "crew",
      landingSiteName: null,
      deliveredOnDay: delivered ? arrivalDayOf(catalogue, rules, plan) : null,
      lostOnDay: delivered ? null : flown.failedOnDay,
      crashed: false,
    },
  ];
}

/**
 * Each place's Crew as Mission Mode shows them at Mars: their ship, for now, from the day the first of them is there.
 * Crew of their own in the views are still to come.
 */
export function crewShipsAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  atWork: CrewAtWork[],
): AssetAtMars[] {
  return atWork.map(({ key, activityId, stays }) => ({
    key: `crew:${key}`,
    name: catalogue.crew.vehicleName,
    kind: "crew",
    landingSiteName: null,
    activityName: rules.activityNameOf({ activityId }),
    surfaceMotion: "still",
    arrivedOnDay: Math.min(
      ...stays.map(({ member }) => daysBetween(program.date, member.arrivedOn)),
    ),
    fromDay: Math.min(...stays.map(({ fromDay }) => fromDay)),
    // The ship stands in for its Crew, so it goes when the last of them dies.
    untilDay: stays.every(({ untilDay }) => untilDay !== null)
      ? Math.max(...stays.map(({ untilDay }) => untilDay ?? 0))
      : null,
  }));
}

/** Every Crew member at Mars at the end of the Turn, with their Health, for the Turn summary. */
export function crewSummary(
  catalogue: Catalogue,
  atWork: CrewAtWork[],
): TurnSummary["crew"] {
  return atWork.flatMap(({ stays }) =>
    stays.flatMap(({ member, fromDay, untilDay, health }) =>
      untilDay !== null
        ? []
        : [
            {
              name: member.name,
              locationName: locationNameOf(member.location),
              health: health.health,
              maxHealth: catalogue.crew.maxHealth,
              arrived: fromDay > 0,
            },
          ],
    ),
  );
}
