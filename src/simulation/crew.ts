import type { Catalogue } from "../catalogue/catalogue";
import { earningsPerTurn } from "./ongoingResearch";
import type { Activity, Rules } from "./rules";
import type { PlannedActivity } from "./previews";
import type {
  CrewMember,
  PlannedMission,
  Program,
  ProgramView,
  TurnPlan,
} from "./types";

/**
 * Crew in planning: the Crew sizes on offer, the names Crew are given, where Crew are and what they do there, and
 * what's wrong with a plan's Crew. What Crew do during a Turn is in `crewAtMars.ts`.
 */

type CrewSize = Catalogue["crew"]["sizes"][number];

/** The Crew operating in one place at Mars, as Planning Mode shows them. */
export interface CrewAtMars {
  /** How a plan names this place to change its Crew's Activity. */
  key: string;
  locationName: string;
  activityId: string;
  activityName: string;
  /** The Activities they can do, with what the Crew there would earn together. */
  activities: PlannedActivity[];
  members: { name: string; health: number; arrivedOn: string }[];
}

/** A Crewed Mission's Crew as Planning Mode shows them before it launches. */
export interface PlannedCrew {
  size: number;
  /** Who would fly: the next names not yet given, which are fewer than `size` if too few are left. */
  names: string[];
  activityId: string;
  /** The Activities they can do, with what this Crew would earn together. */
  activities: PlannedActivity[];
  /** Where they would join Crew already operating, whose Activity they take up, or null if none are there. */
  joining: string | null;
}

/** Crew in Mars orbit, the only place they go so far. */
export const marsOrbit = { kind: "marsOrbit" } as const;

/** Each kind of place where Crew operate: how a plan names it, and how the player reads it. */
const places = {
  marsOrbit: { key: "mars-orbit", name: "Mars orbit" },
} satisfies Record<CrewMember["location"]["kind"], unknown>;

/** How a plan names a place where Crew operate. */
export function crewKeyOf(location: CrewMember["location"]): string {
  return places[location.kind].key;
}

export function locationNameOf(location: CrewMember["location"]): string {
  return places[location.kind].name;
}

/** The Crew size a Mission has chosen, if it has Crew and the size is on offer. */
function crewSizeOf(
  catalogue: Catalogue,
  mission: PlannedMission | null,
): CrewSize | undefined {
  return catalogue.crew.sizes.find(({ crew }) => crew === mission?.crew?.size);
}

/** The names not yet given to Crew in this Program, in the order the Catalogue lists them. */
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

/** The Activities Crew in Mars orbit can do, in the order the Catalogue lists them. */
function crewActivities(catalogue: Catalogue, rules: Rules): Activity[] {
  return catalogue.crew.orbitActivities.flatMap(
    (id) => rules.activityById(id) ?? [],
  );
}

/** An Activity as Planning Mode offers it to this many Crew, who each earn its rate. */
function forCrew(
  catalogue: Catalogue,
  activity: Activity,
  members: number,
): PlannedActivity {
  const each = earningsPerTurn(catalogue, activity);
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
  };
}

/** What the Crew in Mars orbit do this Turn, going by the plan, or undefined if none operate there as it starts. */
function orbitActivityNow(
  program: Program,
  plan: TurnPlan,
): string | undefined {
  const key = crewKeyOf(marsOrbit);
  if (!program.crew.some(({ location }) => crewKeyOf(location) === key)) {
    return undefined;
  }
  return plan.crewActivities?.[key] ?? program.crewActivities[key];
}

/**
 * The Activity a Mission's Crew take up as they arrive: that of the Crew already operating there, or else the one the
 * Mission chose, or else the first the Catalogue lists.
 */
export function arrivingCrewActivity(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): Activity {
  const available = crewActivities(catalogue, rules);
  const chosen =
    orbitActivityNow(program, plan) ?? plan.mission?.crew?.activityId;
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
  const { vehicleName, sizes, maxHealth } = catalogue.crew;
  return {
    vehicleName,
    sizes: sizes.map(({ crew, costMillions, massTonnes }) => ({
      crew,
      costMillions,
      massTonnes,
    })),
    maxHealth,
    namesLeft: namesLeft(catalogue, program).length,
  };
}

/** The Crew operating at Mars, by where they are, for Planning Mode. */
export function crewAtMarsView(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
): CrewAtMars[] {
  const keys = [
    ...new Set(program.crew.map(({ location }) => crewKeyOf(location))),
  ];
  return keys.flatMap((key) => {
    const members = program.crew.filter(
      ({ location }) => crewKeyOf(location) === key,
    );
    const [first] = members;
    if (!first) return [];
    const activityId = program.crewActivities[key] ?? "";
    return [
      {
        key,
        locationName: locationNameOf(first.location),
        activityId,
        activityName: rules.activityNameOf({ activityId }),
        activities: crewActivities(catalogue, rules).map((activity) =>
          forCrew(catalogue, activity, members.length),
        ),
        members: members.map(({ name, health, arrivedOn }) => ({
          name,
          health,
          arrivedOn,
        })),
      },
    ];
  });
}

/** A Mission's Crew as Planning Mode shows them, or null if it carries none. */
export function previewCrew(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
): PlannedCrew | null {
  if (!mission.crew) return null;
  const { size } = mission.crew;
  const plan = { mission };
  return {
    size,
    names: crewNamesFor(catalogue, program, mission),
    activityId: arrivingCrewActivity(catalogue, rules, program, plan).id,
    activities: crewActivities(catalogue, rules).map((activity) =>
      forCrew(catalogue, activity, size),
    ),
    joining:
      orbitActivityNow(program, plan) === undefined
        ? null
        : locationNameOf(marsOrbit),
  };
}

/** What's wrong with an Activity for Crew, if anything. */
function crewActivityProblems(
  catalogue: Catalogue,
  rules: Rules,
  activityId: string,
): string[] {
  const activity = rules.activityById(activityId);
  if (!activity) return [`There is no Activity called "${activityId}".`];
  return catalogue.crew.orbitActivities.includes(activityId)
    ? []
    : [`Crew can't do the Activity "${activity.name}".`];
}

/** What's wrong with a plan's new Activities for Crew already operating, if anything. */
export function operatingCrewProblems(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): string[] {
  return Object.entries(plan.crewActivities ?? {}).flatMap(
    ([key, activityId]) =>
      program.crew.some(({ location }) => crewKeyOf(location) === key)
        ? crewActivityProblems(catalogue, rules, activityId)
        : [`There are no Crew operating at "${key}".`],
  );
}

/** What a Mission's Crew cost and weigh, and what's wrong with them, if anything. */
export function checkCrew(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
): { costMillions: number; massTonnes: number; problems: string[] } {
  const { crew } = mission;
  if (!crew) return { costMillions: 0, massTonnes: 0, problems: [] };
  const size = crewSizeOf(catalogue, mission);
  const left = namesLeft(catalogue, program).length;
  return {
    costMillions: size?.costMillions ?? 0,
    massTonnes: size?.massTonnes ?? 0,
    problems: [
      ...(size ? [] : [`There is no Crew size of ${crew.size}.`]),
      ...(size && left < size.crew
        ? [
            `Only ${left} Crew ${left === 1 ? "member is" : "members are"} left to fly, too few for a Crew of ${size.crew}.`,
          ]
        : []),
      ...(crew.activityId === undefined
        ? []
        : crewActivityProblems(catalogue, rules, crew.activityId)),
    ],
  };
}
