import type { Catalogue } from "../catalogue/catalogue";
import {
  crewAtMarsOf,
  crewKeyOf,
  locationNameOf,
  type CrewMemberAtMars,
} from "./crewPlaces";
import { newStage } from "./earthReturnStages";
import type { MissionOutcome } from "./flight";
import { addDays, type Rules } from "./rules";
import type { ReturnVehicleArrivedEntry } from "./timeline";
import type { TurnSummary } from "./turnSummary";
import type {
  EarthReturnStage,
  PlaceAtMars,
  PlannedMission,
  Program,
  TurnPlan,
} from "./types";

/**
 * Return vehicles: an Earth return stage that a later Mission flies to Mars orbit on its own, with or without Crew of
 * its own, for the Crew in one place at Mars who have no way home, such as those who went one way. It is delivered when
 * its Mission Events take it to Mars orbit, and then waits there as a round trip's stage does (`earthReturnStages.ts`),
 * so that its Crew come home on a later Turn in the same way. A Crewed Mission that carries one swaps Crew: its own stay
 * at Mars one way, and those it fetched can come home.
 */

/** The Crew at Mars with no way home: those no Earth return stage is waiting for. */
export function crewWithoutWayHome(program: Program): CrewMemberAtMars[] {
  const waitedFor = new Set(
    program.earthReturnStages.flatMap(({ crew }) => crew),
  );
  return crewAtMarsOf(program).filter(({ name }) => !waitedFor.has(name));
}

/** The Crew a return vehicle for this place would fetch: those there with no way home as the Turn starts. */
function crewToFetch(program: Program, placeKey: string): CrewMemberAtMars[] {
  return crewWithoutWayHome(program).filter(
    ({ location }) => crewKeyOf(location) === placeKey,
  );
}

/** Where Crew are, to end a sentence, such as "in Mars orbit" or "at Alpha Plain". */
const inPlace = (rules: Rules, place: PlaceAtMars) =>
  `${place.kind === "marsOrbit" ? "in" : "at"} ${locationNameOf(rules, place)}`;

/** What a Mission's return vehicle costs and weighs, and what's wrong with it, if it carries one. */
export function checkReturnVehicle(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
): { costMillions: number; massTonnes: number; problems: string[] } {
  if (!mission.returnVehicle) {
    return { costMillions: 0, massTonnes: 0, problems: [] };
  }
  const vehicle = catalogue.crew.returnVehicle;
  const key = mission.returnVehicle.forCrewAt;
  const there = crewAtMarsOf(program).find(
    ({ location }) => crewKeyOf(location) === key,
  );
  const fetched = crewToFetch(program, key).length;
  const problems = !there
    ? [`There are no Crew at Mars at "${key}".`]
    : fetched === 0
      ? [
          `There are no Crew ${inPlace(rules, there.location)} without a way home to fetch.`,
        ]
      : fetched > vehicle.crewRoom
        ? [
            `The ${vehicle.name} has room for ${vehicle.crewRoom} Crew, but ${fetched} ${inPlace(rules, there.location)} have no way home.`,
          ]
        : [];
  return {
    costMillions: vehicle.costMillions,
    massTonnes: vehicle.massTonnes,
    problems: mission.crew?.roundTrip
      ? [
          ...problems,
          "A Crewed Mission that carries a return vehicle leaves its own Crew at Mars, so it can't make a round trip too.",
        ]
      : problems,
  };
}

/**
 * The Earth return stage the Turn's return vehicle leaves in Mars orbit, if it got there, for the Crew it was sent for,
 * keeping what its Mission bought for their journey home.
 */
export function returnVehicleArriving(
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "returnVehicle">,
): EarthReturnStage[] {
  const { mission } = plan;
  const vehicle = flown.returnVehicle;
  if (!mission?.returnVehicle || !vehicle?.delivered) return [];
  return [
    newStage(
      rules,
      mission,
      addDays(program.date, vehicle.day),
      crewToFetch(program, mission.returnVehicle.forCrewAt).map(
        ({ name }) => name,
      ),
    ),
  ];
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/**
 * How the Turn's return vehicle shows to the player once it is in Mars orbit, if it got there: in the events column, on
 * the day it arrives, and in the Turn summary, each naming those of its Crew still at Mars as the Turn ends.
 */
export function returnVehicleReport(
  flown: Pick<MissionOutcome, "returnVehicle">,
  arriving: EarthReturnStage[],
  stagesAfter: EarthReturnStage[],
): {
  entries: ReturnVehicleArrivedEntry[];
  summary: TurnSummary["returnVehicle"];
} {
  const vehicle = flown.returnVehicle;
  const [stage] = arriving;
  if (!vehicle?.delivered || !stage) return { entries: [], summary: null };
  const crew =
    stagesAfter.find(({ arrivedOn }) => arrivedOn === stage.arrivedOn)?.crew ??
    [];
  return {
    entries: [
      {
        kind: "returnVehicleArrived",
        day: vehicle.day,
        title: `${vehicle.name} in Mars orbit`,
        description:
          crew.length > 0
            ? `The ${vehicle.name} waits in Mars orbit to bring ${listOfNames.format(crew)} home on a later Turn.`
            : `The ${vehicle.name} is in Mars orbit, but none of the Crew it was sent for are left at Mars.`,
      },
    ],
    summary: { name: vehicle.name, crew },
  };
}
