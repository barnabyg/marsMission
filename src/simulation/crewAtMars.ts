import type { Catalogue } from "../catalogue/catalogue";
import {
  arrivingCrewActivity,
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  placeFor,
  type CrewMemberAtMars,
} from "./crew";
import { crewDeliveryDayOf, type MissionOutcome } from "./flight";
import {
  bothLost,
  drainsAtMars,
  healthCourse,
  type HealthBlow,
  type HealthCourse,
} from "./health";
import { crewLoss, type CrewLoss } from "./lostCrew";
import { addDays, daysBetween, type Rules } from "./rules";
import type { AssetAtMars, CrewArrivedEntry, MissionAsset } from "./timeline";
import type { TurnSummary } from "./turnSummary";
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
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** A Crew member's days at Mars from `fromDay` to the end of the Turn, with these blows to their Health. */
function stayOf(
  catalogue: Catalogue,
  member: CrewMemberAtMars,
  fromDay: number,
  blows: HealthBlow[],
): CrewStay {
  const health = healthCourse(
    member.health,
    drainsAtMars(
      catalogue,
      fromDay,
      catalogue.program.launchWindowIntervalDays,
    ),
    blows,
  );
  return { member, fromDay, untilDay: health.diedOn, health, blows };
}

/** A Crew member's stay with one more blow to their Health, which can end it sooner. */
export function hurt(
  catalogue: Catalogue,
  stay: CrewStay,
  blow: HealthBlow,
): CrewStay {
  return {
    ...stay,
    ...stayOf(catalogue, stay.member, stay.fromDay, [...stay.blows, blow]),
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
  flown: Pick<MissionOutcome, "deliveredCrew" | "crewHealth" | "heldLanding">,
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
  const stays = [
    ...crewAtMarsOf(program).map((member) => stayOf(catalogue, member, 0, [])),
    ...arrived.map((member) => stayOf(catalogue, member, arrivalDay, [])),
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
    return [
      {
        key,
        place: where,
        locationName,
        name: `Crew in ${locationName}`,
        activityId: crewActivities[key] ?? "",
        stays: here,
      },
    ];
  });
  return { atWork, arrived, crewActivities };
}

/**
 * Who of the Crew at Mars is still there at the end of the Turn, with the Health they have left, and who died there
 * when their Health ran out. A place whose Crew have all died drops out of what Crew do.
 */
export function crewAtTurnEnd(
  atWork: CrewAtWork[],
  crewActivities: Record<string, string>,
): {
  stillThere: CrewMemberAtMars[];
  deaths: CrewLoss[];
  crewActivities: Record<string, string>;
} {
  const deaths = atWork.flatMap(({ stays: here, locationName }) => {
    const days = [
      ...new Set(here.flatMap(({ untilDay }) => untilDay ?? [])),
    ].toSorted((first, second) => first - second);
    return days.flatMap((day) =>
      crewLoss(
        here
          .filter(({ untilDay }) => untilDay === day)
          .map(({ member }) => member.name),
        day,
        "health",
        `in ${locationName}, when their Health ran out`,
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

/** The events column's entry for the Crew arriving in Mars orbit or landing, if they did. */
export function crewArrivedEntry(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "heldLanding">,
  arrived: CrewMemberAtMars[],
  crewActivities: Record<string, string>,
): CrewArrivedEntry[] {
  const [first] = arrived;
  if (!first) return [];
  const where = locationNameOf(rules, first.location);
  const activityId = crewActivities[crewKeyOf(first.location)] ?? "";
  const doing = rules.activityById(activityId);
  const how = first.location.kind === "marsOrbit" ? "arrived" : "landed";
  return [
    {
      kind: "crewArrived",
      day: crewDeliveryDayOf(rules, plan, flown),
      title: `Crew in ${where}`,
      description: `${listOfNames.format(arrived.map(({ name }) => name))} have ${how} in ${where} aboard the ${catalogue.crew.vehicleName}, and ${
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
  flown: Pick<
    MissionOutcome,
    "deliveredCrew" | "failedOnDay" | "failedEvent" | "heldLanding"
  >,
): MissionAsset[] {
  if (!plan.mission?.crew) return [];
  const delivered = flown.deliveredCrew.length > 0;
  const place = placeFor(plan.mission);
  const lands = place.kind === "landingSite";
  return [
    {
      name: catalogue.crew.vehicleName,
      kind: "crew",
      landingSiteName: lands ? locationNameOf(rules, place) : null,
      deliveredOnDay: delivered ? crewDeliveryDayOf(rules, plan, flown) : null,
      lostOnDay: delivered ? null : flown.failedOnDay,
      crashed:
        !delivered &&
        lands &&
        // Crashing is failing a Mission Event that only landing brings.
        flown.failedEvent !== undefined &&
        catalogue.crew.landingMissionEvents.includes(flown.failedEvent.id) &&
        !catalogue.crew.missionEvents.includes(flown.failedEvent.id),
    },
  ];
}

/**
 * Each place's Crew as Mission Mode shows them at Mars: their ship, for now, in orbit or standing at their Landing
 * Site, from the day the first of them is there. Crew of their own in the views are still to come.
 */
export function crewShipsAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  atWork: CrewAtWork[],
): AssetAtMars[] {
  return atWork.map(({ key, place, locationName, activityId, stays }) => ({
    key: `crew:${key}`,
    name: catalogue.crew.vehicleName,
    kind: "crew",
    landingSiteName: place.kind === "landingSite" ? locationName : null,
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
  return atWork.flatMap(({ stays, locationName }) =>
    stays.flatMap(({ member, fromDay, untilDay, health }) =>
      untilDay !== null
        ? []
        : [
            {
              name: member.name,
              locationName,
              health: health.health,
              maxHealth: catalogue.crew.maxHealth,
              arrived: fromDay > 0,
            },
          ],
    ),
  );
}
