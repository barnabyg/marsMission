import type { Catalogue } from "../catalogue/catalogue";
import {
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  placeFor,
} from "./crewPlaces";
import type { Activity, Rules } from "./rules";
import { protectionOf } from "./protection";
import { suppliesOptionOf } from "./supplies";
import type { PlaceAtMars, PlannedMission, Program, TurnPlan } from "./types";

/**
 * Crew in planning: the Crew sizes on offer, the names Crew are given, what they do in each place, and what's wrong
 * with a plan's Crew. Where Crew are is in `crewPlaces.ts`, what Planning Mode shows of them in `crewView.ts`, and what
 * Crew do during a Turn in `crewAtMars.ts`.
 */

type CrewSize = Catalogue["crew"]["sizes"][number];

/** The Crew size a Mission has chosen, if it has Crew and the size is on offer. */
function crewSizeOf(
  catalogue: Catalogue,
  mission: PlannedMission | null,
): CrewSize | undefined {
  return catalogue.crew.sizes.find(({ crew }) => crew === mission?.crew?.size);
}

/** The names not yet given to Crew in this Program, in the order the Catalogue lists them. Lost and home Crew keep theirs. */
export function namesLeft(catalogue: Catalogue, program: Program): string[] {
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
export function crewActivities(
  catalogue: Catalogue,
  rules: Rules,
  place: PlaceAtMars,
): Activity[] {
  return activityIdsAt(catalogue, place).flatMap(
    (id) => rules.activityById(id) ?? [],
  );
}

/** What the Crew in a place do this Turn, going by the plan, or undefined if none operate there as it starts. */
export function activityNowAt(
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

/** What a Mission's Crew, their Supplies and their Protection cost and weigh, and what's wrong with them, if anything. */
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
  const protection = protectionOf(catalogue, mission);
  const left = namesLeft(catalogue, program).length;
  const returnStage = crew.roundTrip ? catalogue.crew.roundTrip : null;
  return {
    costMillions:
      (size?.costMillions ?? 0) +
      (supplies?.costMillions ?? 0) +
      (protection?.costMillions ?? 0) +
      (returnStage?.costMillions ?? 0),
    massTonnes:
      (size?.massTonnes ?? 0) +
      (supplies?.massTonnes ?? 0) +
      (protection?.massTonnes ?? 0) +
      (returnStage?.massTonnes ?? 0),
    problems: [
      ...(size ? [] : [`There is no Crew size of ${crew.size}.`]),
      ...(supplies
        ? []
        : [`There are no Supplies called "${crew.suppliesId}".`]),
      ...(protection
        ? []
        : [`There is no Protection called "${crew.protectionId}".`]),
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
