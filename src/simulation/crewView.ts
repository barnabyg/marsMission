import type { Catalogue } from "../catalogue/catalogue";
import type { Raise } from "./benefits";
import {
  arrivingCrewActivity,
  crewActivities,
  crewNamesFor,
  activityNowAt,
  namesLeft,
} from "./crew";
import {
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  placeFor,
} from "./crewPlaces";
import { waysHomeFrom } from "./earthReturnStages";
import { crewWithoutWayHome } from "./returnVehicles";
import { drainsInFlight, healthCourse } from "./health";
import { earningsPerTurn } from "./ongoingResearch";
import type { Activity, Rules } from "./rules";
import type { PlannedActivity } from "./previews";
import { protectionOf } from "./protection";
import { daysOfSupplies, kilogramsOf, suppliesOptionOf } from "./supplies";
import type {
  PlannedMission,
  PlaceAtMars,
  Program,
  ProgramView,
} from "./types";

/** Crew as Planning Mode shows them: those at Mars, what a Crewed Mission offers, and a Mission's Crew before it launches. */

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
  /**
   * The Earth return stages that can bring round-trip Crew here home, each with who it would bring, the day they would
   * leave Mars and the day they would be home, and why it can't this Turn, such as too little ascent propellant for
   * Mars ascent, or null if it can.
   */
  waysHome: {
    key: string;
    names: string[];
    leavesMarsOn: string;
    homeOn: string;
    /** The samples they would bring home: those at their Landing Site as the Turn starts, and their own. */
    samples: number;
    reason: string | null;
  }[];
  /** The Crew here with no way home, such as those who went one way, whom a return vehicle can fetch. */
  withoutWayHome: string[];
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
  /** The Health each would have left on arriving, after radiation on the way slowed by their Protection, if nothing else harms them. */
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
  /** The Protection they carry, by id. */
  protectionId: string;
  /**
   * The Protection on offer, from none to the most, with by what share each slows radiation's harm and the Health each
   * would leave this Crew on arriving.
   */
  protection: {
    id: string;
    name: string;
    costMillions: number;
    massTonnes: number;
    radiationCutPercent: number;
    arrivalHealth: number;
  }[];
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
    // Crew bring samples home of their own, rather than caching them.
    cachesPerTurn: null,
    ...(raise && each ? { raisedBy: raise } : {}),
  };
}

/** The raise that applies to Crew in a place, which is only ever on the surface. */
const raiseAt = (place: PlaceAtMars, raise: Raise | null) =>
  place.kind === "landingSite" ? raise : null;

/** What a Crewed Mission offers, for Planning Mode. */
export function crewedMissionView(
  catalogue: Catalogue,
  program: Program,
): ProgramView["crewedMission"] {
  const { vehicleName, sizes, maxHealth, supplies, protection } =
    catalogue.crew;
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
    protection: protection.map(
      ({ id, name, costMillions, massTonnes, radiationCutPercent }) => ({
        id,
        name,
        costMillions,
        massTonnes,
        radiationCutPercent,
      }),
    ),
    maxHealth,
    namesLeft: namesLeft(catalogue, program).length,
    roundTrip: {
      name: catalogue.crew.roundTrip.name,
      description: catalogue.crew.roundTrip.description,
      costMillions: catalogue.crew.roundTrip.costMillions,
      massTonnes: catalogue.crew.roundTrip.massTonnes,
      ascentPropellantKg: catalogue.crew.roundTrip.ascent.propellantKg,
    },
    returnVehicle: {
      name: catalogue.crew.returnVehicle.name,
      description: catalogue.crew.returnVehicle.description,
      costMillions: catalogue.crew.returnVehicle.costMillions,
      massTonnes: catalogue.crew.returnVehicle.massTonnes,
      crewRoom: catalogue.crew.returnVehicle.crewRoom,
    },
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
  const stranded = new Set(crewWithoutWayHome(program).map(({ name }) => name));
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
        // Crew at a Landing Site draw on the Supplies held in habitats there too.
        suppliesDaysLeft: daysOfSupplies(
          catalogue,
          (program.crewSupplies[key] ?? 0) +
            (place.kind === "landingSite"
              ? (program.habitatSuppliesKg[place.landingSiteId] ?? 0)
              : 0),
          members.length,
        ),
        waysHome: waysHomeFrom(catalogue, rules, program, key),
        withoutWayHome: members
          .filter(({ name }) => stranded.has(name))
          .map(({ name }) => name),
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
  const arrivalDay = rules.deliveryDay(rules.crewOf(mission), mission);
  const arrivalHealth = (radiationCutPercent: number) =>
    healthCourse(
      catalogue.crew.maxHealth,
      drainsInFlight(catalogue, arrivalDay, radiationCutPercent),
      [],
    ).health;
  const protection = protectionOf(catalogue, mission);
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
    arrivalHealth: arrivalHealth(protection?.radiationCutPercent ?? 0),
    suppliesId: suppliesOptionOf(catalogue, mission)?.id ?? "",
    supplies: catalogue.crew.supplies.options.map((option) => ({
      id: option.id,
      name: option.name,
      costMillions: option.costMillions,
      massTonnes: option.massTonnes,
      days: daysOfSupplies(catalogue, kilogramsOf(option), size),
    })),
    protectionId: protection?.id ?? "",
    protection: catalogue.crew.protection.map((level) => ({
      id: level.id,
      name: level.name,
      costMillions: level.costMillions,
      massTonnes: level.massTonnes,
      radiationCutPercent: level.radiationCutPercent,
      arrivalHealth: arrivalHealth(level.radiationCutPercent),
    })),
  };
}
