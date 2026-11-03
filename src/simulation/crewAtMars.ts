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
  /** Each Crew member's days there in this Turn. Nothing ends their stay yet. */
  stays: {
    member: CrewMemberAtMars;
    fromDay: number;
    untilDay: number | null;
  }[];
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** The day of the Turn the Mission delivers its Crew, if it carried any. */
const arrivalDayOf = (catalogue: Catalogue, rules: Rules, plan: TurnPlan) =>
  rules.deliveryDay(catalogue.crew, plan.mission);

/**
 * The Crew at Mars this Turn: those already there, and any the Mission delivers, who arrive in Mars orbit at full
 * Health and take up the Activity of any Crew already there. Also what each place's Crew do from now on.
 */
export function crewAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "deliveredCrew">,
): {
  atWork: CrewAtWork[];
  arrived: CrewMemberAtMars[];
  crewActivities: Record<string, string>;
} {
  const arrivalDay = arrivalDayOf(catalogue, rules, plan);
  const arrived = flown.deliveredCrew.map((name): CrewMemberAtMars => ({
    name,
    health: catalogue.crew.maxHealth,
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
    ...crewAtMarsOf(program).map((member) => ({
      member,
      fromDay: 0,
      untilDay: null,
    })),
    ...arrived.map((member) => ({
      member,
      fromDay: arrivalDay,
      untilDay: null,
    })),
  ];
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
  return { atWork, arrived, crewActivities };
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
    untilDay: null,
  }));
}

/** Every Crew member at Mars at the end of the Turn, with their Health, for the Turn summary. */
export function crewSummary(
  catalogue: Catalogue,
  atWork: CrewAtWork[],
): TurnSummary["crew"] {
  return atWork.flatMap(({ stays }) =>
    stays.map(({ member, fromDay }) => ({
      name: member.name,
      locationName: locationNameOf(member.location),
      health: member.health,
      maxHealth: catalogue.crew.maxHealth,
      arrived: fromDay > 0,
    })),
  );
}
