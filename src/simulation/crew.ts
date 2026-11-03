import type { Catalogue } from "../catalogue/catalogue";
import type { Raise } from "./benefits";
import { drainsInFlight, healthCourse } from "./health";
import { earningsPerTurn } from "./ongoingResearch";
import type { Activity, Rules } from "./rules";
import type { PlannedActivity } from "./previews";
import { daysOfSupplies, kilogramsOf, suppliesOptionOf } from "./supplies";
import type {
  CrewMember,
  PlaceAtMars,
  PlannedMission,
  Program,
  ProgramView,
  TurnPlan,
} from "./types";

/**
 * Crew in planning: the Crew sizes on offer, the names Crew are given, where Crew are (Mars orbit or a Landing Site,
 * each a place of its own) and what they do there, and what's wrong with a plan's Crew. What Crew do during a Turn is
 * in `crewAtMars.ts`.
 */

type CrewSize = Catalogue["crew"]["sizes"][number];

/** The Crew operating in one place at Mars, as Planning Mode shows them. */
export interface CrewAtMars {
  /** How a plan names this place to change its Crew's Activity. */
  key: string;
  locationName: string;
  /** The Landing Site they are at, or null if they are in Mars orbit. */
  landingSiteId: string | null;
  activityId: string;
  activityName: string;
  /** The Activities they can do, with what the Crew there would earn together. */
  activities: PlannedActivity[];
  members: { name: string; health: number; arrivedOn: string }[];
  /** How many days the Supplies they share will last them all, which is 0 once they have run out. */
  suppliesDaysLeft: number;
}

/** A Crewed Mission's Crew as Planning Mode shows them before it launches. */
export interface PlannedCrew {
  size: number;
  /** Who would fly: the next names not yet given, which are fewer than `size` if too few are left. */
  names: string[];
  activityId: string;
  /** The Activities they can do where they are going, with what this Crew would earn together. */
  activities: PlannedActivity[];
  /** Where they would join Crew already operating, whose Activity they take up, or null if none are there. */
  joining: string | null;
  /** The Health each would have left on arriving, after radiation on the way, if nothing else harms them. */
  arrivalHealth: number;
  /** The Supplies they carry, by id. */
  suppliesId: string;
  /** The Supplies on offer, least first, with how many days each would last this Crew from launch. */
  supplies: {
    id: string;
    name: string;
    costMillions: number;
    massTonnes: number;
    days: number;
  }[];
}

/** Crew in Mars orbit, where a Crewed Mission goes unless its Crew land. */
const marsOrbit = { kind: "marsOrbit" } as const;

/** How a plan names a place where Crew operate. Each Landing Site is a place of its own. */
export function crewKeyOf(location: PlaceAtMars): string {
  return location.kind === "marsOrbit"
    ? "mars-orbit"
    : `landing-site:${location.landingSiteId}`;
}

/** Where Crew are, as the player reads it: Mars orbit, or their Landing Site's name. */
export function locationNameOf(rules: Rules, location: PlaceAtMars): string {
  return location.kind === "marsOrbit"
    ? "Mars orbit"
    : (rules.landingSiteById(location.landingSiteId)?.name ??
        location.landingSiteId);
}

/** Where a Mission's Crew go: to its Landing Site if they land there, and otherwise to Mars orbit. */
export function placeFor(mission: PlannedMission | null): PlaceAtMars {
  return mission?.crew?.landsAtSite && mission.landingSiteId !== undefined
    ? { kind: "landingSite", landingSiteId: mission.landingSiteId }
    : marsOrbit;
}

/** A Crew member operating at Mars, who is neither lost nor home. */
export type CrewMemberAtMars = CrewMember & {
  arrivedOn: string;
  location: PlaceAtMars;
};

const isAtMars = (member: CrewMember): member is CrewMemberAtMars =>
  (member.location.kind === "marsOrbit" ||
    member.location.kind === "landingSite") &&
  member.arrivedOn !== null;

/** The Program's Crew operating at Mars, in the order they arrived, leaving out those who are lost or home. */
export function crewAtMarsOf(program: Program): CrewMemberAtMars[] {
  return program.crew.filter(isAtMars);
}

/** The Crew size a Mission has chosen, if it has Crew and the size is on offer. */
function crewSizeOf(
  catalogue: Catalogue,
  mission: PlannedMission | null,
): CrewSize | undefined {
  return catalogue.crew.sizes.find(({ crew }) => crew === mission?.crew?.size);
}

/** The names not yet given to Crew in this Program, in the order the Catalogue lists them. Lost and home Crew keep theirs. */
function namesLeft(catalogue: Catalogue, program: Program): string[] {
  const given = new Set(program.crew.map(({ name }) => name));
  return catalogue.crew.names.filter((name) => !given.has(name));
}

/** The names of the Crew a Mission would fly, which may be fewer than its size if too few are left. */
export function crewNamesFor(
  catalogue: Catalogue,
  program: Program,
  mission: PlannedMission | null,
): string[] {
  return namesLeft(catalogue, program).slice(0, mission?.crew?.size ?? 0);
}

/** The ids of the Activities Crew can do in a place: in Mars orbit, or on the surface. */
function activityIdsAt(catalogue: Catalogue, place: PlaceAtMars): string[] {
  return place.kind === "marsOrbit"
    ? catalogue.crew.orbitActivities
    : catalogue.crew.surfaceActivities;
}

/** The Activities Crew can do in a place, in the order the Catalogue lists them. */
function crewActivities(
  catalogue: Catalogue,
  rules: Rules,
  place: PlaceAtMars,
): Activity[] {
  return activityIdsAt(catalogue, place).flatMap(
    (id) => rules.activityById(id) ?? [],
  );
}

/**
 * An Activity as Planning Mode offers it to this many Crew, who each earn its rate, raised as research on the surface
 * is if they are at a Landing Site and a Benefit raises it.
 */
function forCrew(
  catalogue: Catalogue,
  activity: Activity,
  members: number,
  raise: Raise | null,
): PlannedActivity {
  const each = earningsPerTurn(catalogue, activity, raise?.percent);
  return {
    id: activity.id,
    name: activity.name,
    description: activity.description,
    surveys: false,
    earnsPerTurn: each && {
      science: each.science * members,
      publicSupport: each.publicSupport * members,
      researchGrantMillions: each.researchGrantMillions * members,
    },
    ...(raise && each ? { raisedBy: raise } : {}),
  };
}

/** The raise that applies to Crew in a place, which is only ever on the surface. */
const raiseAt = (place: PlaceAtMars, raise: Raise | null) =>
  place.kind === "landingSite" ? raise : null;

/** What the Crew in a place do this Turn, going by the plan, or undefined if none operate there as it starts. */
function activityNowAt(
  program: Program,
  plan: TurnPlan,
  place: PlaceAtMars,
): string | undefined {
  const key = crewKeyOf(place);
  if (
    !crewAtMarsOf(program).some(({ location }) => crewKeyOf(location) === key)
  ) {
    return undefined;
  }
  return plan.crewActivities?.[key] ?? program.crewActivities[key];
}

/**
 * The Activity a Mission's Crew take up as they arrive: that of the Crew already operating where they go, or else the
 * one the Mission chose, or else the first the Catalogue lists for that place.
 */
export function arrivingCrewActivity(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): Activity {
  const place = placeFor(plan.mission);
  const available = crewActivities(catalogue, rules, place);
  const chosen =
    activityNowAt(program, plan, place) ?? plan.mission?.crew?.activityId;
  const activity = available.find(({ id }) => id === chosen) ?? available[0];
  // The Catalogue guarantees at least one, and that each one exists.
  if (!activity) throw new Error("Crew have no Activities");
  return activity;
}

/** What a Crewed Mission offers, for Planning Mode. */
export function crewedMissionView(
  catalogue: Catalogue,
  program: Program,
): ProgramView["crewedMission"] {
  const { vehicleName, sizes, maxHealth, supplies } = catalogue.crew;
  return {
    vehicleName,
    sizes: sizes.map(({ crew, costMillions, massTonnes }) => ({
      crew,
      costMillions,
      massTonnes,
    })),
    supplies: supplies.options.map(
      ({ id, name, costMillions, massTonnes }) => ({
        id,
        name,
        costMillions,
        massTonnes,
      }),
    ),
    maxHealth,
    namesLeft: namesLeft(catalogue, program).length,
  };
}

/** The Crew operating at Mars, by where they are, for Planning Mode, with research on the surface raised by `raise`. */
export function crewAtMarsView(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  raise: Raise | null,
): CrewAtMars[] {
  const atMars = crewAtMarsOf(program);
  const keys = [...new Set(atMars.map(({ location }) => crewKeyOf(location)))];
  return keys.flatMap((key) => {
    const members = atMars.filter(
      ({ location }) => crewKeyOf(location) === key,
    );
    const [first] = members;
    if (!first) return [];
    const place = first.location;
    const activityId = program.crewActivities[key] ?? "";
    return [
      {
        key,
        locationName: locationNameOf(rules, place),
        landingSiteId:
          place.kind === "landingSite" ? place.landingSiteId : null,
        activityId,
        activityName: rules.activityNameOf({ activityId }),
        activities: crewActivities(catalogue, rules, place).map((activity) =>
          forCrew(catalogue, activity, members.length, raiseAt(place, raise)),
        ),
        members: members.map(({ name, health, arrivedOn }) => ({
          name,
          health,
          arrivedOn,
        })),
        suppliesDaysLeft: daysOfSupplies(
          catalogue,
          program.crewSupplies[key] ?? 0,
          members.length,
        ),
      },
    ];
  });
}

/**
 * A Mission's Crew as Planning Mode shows them, with research on the surface raised by `raise`, or null if it carries
 * none.
 */
export function previewCrew(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
  raise: Raise | null,
): PlannedCrew | null {
  if (!mission.crew) return null;
  const { size } = mission.crew;
  const plan = { mission };
  const place = placeFor(mission);
  return {
    size,
    names: crewNamesFor(catalogue, program, mission),
    activityId: arrivingCrewActivity(catalogue, rules, program, plan).id,
    activities: crewActivities(catalogue, rules, place).map((activity) =>
      forCrew(catalogue, activity, size, raiseAt(place, raise)),
    ),
    joining:
      activityNowAt(program, plan, place) === undefined
        ? null
        : locationNameOf(rules, place),
    arrivalHealth: healthCourse(
      catalogue.crew.maxHealth,
      drainsInFlight(
        catalogue,
        rules.deliveryDay(rules.crewOf(mission), mission),
      ),
      [],
    ).health,
    suppliesId: suppliesOptionOf(catalogue, mission)?.id ?? "",
    supplies: catalogue.crew.supplies.options.map((option) => ({
      id: option.id,
      name: option.name,
      costMillions: option.costMillions,
      massTonnes: option.massTonnes,
      days: daysOfSupplies(catalogue, kilogramsOf(option), size),
    })),
  };
}

/** What's wrong with an Activity for Crew in a place, if anything. */
function crewActivityProblems(
  catalogue: Catalogue,
  rules: Rules,
  place: PlaceAtMars,
  activityId: string,
): string[] {
  const activity = rules.activityById(activityId);
  if (!activity) return [`There is no Activity called "${activityId}".`];
  return activityIdsAt(catalogue, place).includes(activityId)
    ? []
    : [
        `Crew in ${locationNameOf(rules, place)} can't do the Activity "${activity.name}".`,
      ];
}

/** What's wrong with a plan's new Activities for Crew already operating, if anything. */
export function operatingCrewProblems(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): string[] {
  return Object.entries(plan.crewActivities ?? {}).flatMap(
    ([key, activityId]) => {
      const there = crewAtMarsOf(program).find(
        ({ location }) => crewKeyOf(location) === key,
      );
      return there
        ? crewActivityProblems(catalogue, rules, there.location, activityId)
        : [`There are no Crew operating at "${key}".`];
    },
  );
}

/** What a Mission's Crew and their Supplies cost and weigh, and what's wrong with them, if anything. */
export function checkCrew(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
): { costMillions: number; massTonnes: number; problems: string[] } {
  const { crew } = mission;
  if (!crew) return { costMillions: 0, massTonnes: 0, problems: [] };
  const size = crewSizeOf(catalogue, mission);
  const supplies = suppliesOptionOf(catalogue, mission);
  const left = namesLeft(catalogue, program).length;
  return {
    costMillions: (size?.costMillions ?? 0) + (supplies?.costMillions ?? 0),
    massTonnes: (size?.massTonnes ?? 0) + (supplies?.massTonnes ?? 0),
    problems: [
      ...(size ? [] : [`There is no Crew size of ${crew.size}.`]),
      ...(supplies
        ? []
        : [`There are no Supplies called "${crew.suppliesId}".`]),
      ...(size && left < size.crew
        ? [
            `Only ${left} Crew ${left === 1 ? "member is" : "members are"} left to fly, too few for a Crew of ${size.crew}.`,
          ]
        : []),
      ...(crew.activityId === undefined
        ? []
        : crewActivityProblems(
            catalogue,
            rules,
            placeFor(mission),
            crew.activityId,
          )),
    ],
  };
}
