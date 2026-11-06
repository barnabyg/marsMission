import type { Catalogue } from "../catalogue/catalogue";
import { formatPropellant } from "./ascentPropellant";
import { crewAtMarsOf, crewKeyOf, locationNameOf } from "./crewPlaces";
import { addDays, type Rules } from "./rules";
import type {
  EarthReturnStage,
  PlaceAtMars,
  PlannedMission,
  Program,
  TurnPlan,
} from "./types";

/**
 * Earth return stages: what a round trip leaves in Mars orbit with its Crew, or a return vehicle for Crew already there
 * (`returnVehicles.ts`), waiting to bring them home on a later Turn when the player chooses. Each keeps the Reliability
 * and Contingencies bought for the journey home with its Mission, and is gone once its journey home has flown or none
 * of its Crew are left at Mars. Crew who landed reach it through Mars ascent, which needs the ascent propellant at their
 * Landing Site. The journey itself is flown by `journeyHome.ts`.
 */

/** How a plan names an Earth return stage to bring its Crew home. One Mission arrives each Turn, so no two share a day. */
const stageKeyOf = ({ arrivedOn }: { arrivedOn: string }): string =>
  `earth-return-stage:${arrivedOn}`;

/** The day of the Turn a journey home leaves Mars, and the day it is home if nothing goes wrong. */
export function journeyHomeDays(
  catalogue: Catalogue,
  rules: Rules,
): { leavesOn: number; homeOn: number } {
  const leavesOn = catalogue.crew.roundTrip.leavesMarsOnDay;
  const last = rules.journeyHomeEvents().at(-1);
  return { leavesOn, homeOn: leavesOn + (last?.timing.days ?? 0) };
}

/**
 * The Earth return stage a plan brings home this Turn, with its Crew at Mars as the Turn starts and where they are, if it
 * names one. A round trip's Crew arrive together, so they are all in one place.
 */
export function stageComingHome(
  program: Program,
  plan: TurnPlan,
): { stage: EarthReturnStage; names: string[]; from: PlaceAtMars } | null {
  const stage = program.earthReturnStages.find(
    (candidate) => stageKeyOf(candidate) === plan.bringHome,
  );
  if (!stage) return null;
  const here = crewAtMarsOf(program).filter(({ name }) =>
    stage.crew.includes(name),
  );
  const [first] = here;
  return first
    ? { stage, names: here.map(({ name }) => name), from: first.location }
    : null;
}

/**
 * Why Crew in this place can't come home this Turn, or null if they can: Crew at a Landing Site need the ascent
 * propellant that Mars ascent uses up there.
 */
function cantLeave(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  from: PlaceAtMars,
): string | null {
  if (from.kind !== "landingSite") return null;
  const needKg = catalogue.crew.roundTrip.ascent.propellantKg;
  const haveKg = program.ascentPropellantKg[from.landingSiteId] ?? 0;
  return haveKg >= needKg
    ? null
    : `Mars ascent from ${locationNameOf(rules, from)} needs ${formatPropellant(needKg)} of ascent propellant, but only ${formatPropellant(haveKg)} is there. A fuel plant there makes it.`;
}

/** What's wrong with the journey home a plan chooses, if anything. */
export function journeyHomeProblems(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
): string[] {
  if (plan.bringHome === undefined) return [];
  const coming = stageComingHome(program, plan);
  if (!coming) {
    return [
      `There are no Crew at Mars waiting to come home aboard "${plan.bringHome}".`,
    ];
  }
  const reason = cantLeave(catalogue, rules, program, coming.from);
  return reason === null ? [] : [reason];
}

/**
 * The ways home that Planning Mode offers the Crew in one place at Mars, by the place's key, each with why it can't be
 * taken this Turn, if it can't.
 */
export function waysHomeFrom(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  placeKey: string,
): {
  key: string;
  names: string[];
  leavesMarsOn: string;
  homeOn: string;
  reason: string | null;
}[] {
  const there = crewAtMarsOf(program).filter(
    ({ location }) => crewKeyOf(location) === placeKey,
  );
  const here = new Set(there.map(({ name }) => name));
  const from = there[0]?.location;
  if (!from) return [];
  const reason = cantLeave(catalogue, rules, program, from);
  const { leavesOn, homeOn } = journeyHomeDays(catalogue, rules);
  return program.earthReturnStages.flatMap((stage) => {
    const names = stage.crew.filter((name) => here.has(name));
    return names.length > 0
      ? [
          {
            key: stageKeyOf(stage),
            names,
            leavesMarsOn: addDays(program.date, leavesOn),
            homeOn: addDays(program.date, homeOn),
            reason,
          },
        ]
      : [];
  });
}

/**
 * An Earth return stage arriving in Mars orbit on this day for these Crew, keeping what its Mission bought for their
 * journey home.
 */
export function newStage(
  rules: Rules,
  mission: PlannedMission | null,
  arrivedOn: string,
  crew: string[],
): EarthReturnStage {
  const homeward = rules.homewardEventsFor(mission);
  const homewardIds = new Set(homeward.map(({ id }) => id));
  return {
    arrivedOn,
    crew,
    reliability: Object.fromEntries(
      Object.entries(mission?.reliability ?? {}).filter(([eventId]) =>
        homewardIds.has(eventId),
      ),
    ),
    contingencyIds: (mission?.contingencyIds ?? []).filter((id) =>
      homeward.some(
        (event) => rules.contingencyFor(mission, event.id)?.id === id,
      ),
    ),
  };
}

/** The Earth return stage a round-trip Mission's Crew arrive with, if they arrive, keeping what it bought for the way home. */
export function stageArriving(
  rules: Rules,
  mission: PlannedMission | null,
  arrived: { name: string; arrivedOn: string }[],
): EarthReturnStage[] {
  const [first] = arrived;
  if (!first || !mission?.crew?.roundTrip) return [];
  return [
    newStage(
      rules,
      mission,
      first.arrivedOn,
      arrived.map(({ name }) => name),
    ),
  ];
}

/**
 * The Earth return stages left in Mars orbit as a Turn ends: those already there and any that arrived, less the one
 * whose journey home flew, each still for those of its Crew who are at Mars, and none left with no Crew to bring home.
 */
export function stagesAfterTurn(
  program: Program,
  plan: TurnPlan,
  arriving: EarthReturnStage[],
  stillThere: readonly { name: string }[],
): EarthReturnStage[] {
  const atMars = new Set(stillThere.map(({ name }) => name));
  return [...program.earthReturnStages, ...arriving].flatMap((stage) => {
    if (stageKeyOf(stage) === plan.bringHome) return [];
    const crew = stage.crew.filter((name) => atMars.has(name));
    return crew.length > 0 ? [{ ...stage, crew }] : [];
  });
}
