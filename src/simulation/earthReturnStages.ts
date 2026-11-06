import type { Catalogue } from "../catalogue/catalogue";
import { crewAtMarsOf, crewKeyOf } from "./crewPlaces";
import { addDays, type Rules } from "./rules";
import type {
  EarthReturnStage,
  PlannedMission,
  Program,
  TurnPlan,
} from "./types";

/**
 * Earth return stages: what a round trip leaves in Mars orbit with its Crew, waiting to bring them home on a later Turn
 * when the player chooses. Each keeps the Reliability and Contingencies bought for the journey home with its Mission,
 * and is gone once its journey home has flown or none of its Crew are left at Mars. The journey itself is flown by
 * `journeyHome.ts`.
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

/** The Earth return stage a plan brings home this Turn, with its Crew at Mars as the Turn starts, if it names one. */
export function stageComingHome(
  program: Program,
  plan: TurnPlan,
): { stage: EarthReturnStage; names: string[] } | null {
  const stage = program.earthReturnStages.find(
    (candidate) => stageKeyOf(candidate) === plan.bringHome,
  );
  if (!stage) return null;
  const atMars = new Set(crewAtMarsOf(program).map(({ name }) => name));
  const names = stage.crew.filter((name) => atMars.has(name));
  return names.length > 0 ? { stage, names } : null;
}

/** What's wrong with the journey home a plan chooses, if anything. */
export function journeyHomeProblems(
  program: Program,
  plan: TurnPlan,
): string[] {
  return plan.bringHome === undefined || stageComingHome(program, plan)
    ? []
    : [
        `There are no Crew at Mars waiting to come home aboard "${plan.bringHome}".`,
      ];
}

/** The ways home that Planning Mode offers the Crew in one place at Mars, by the place's key. */
export function waysHomeFrom(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  placeKey: string,
): { key: string; names: string[]; leavesMarsOn: string; homeOn: string }[] {
  const here = new Set(
    crewAtMarsOf(program)
      .filter(({ location }) => crewKeyOf(location) === placeKey)
      .map(({ name }) => name),
  );
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
          },
        ]
      : [];
  });
}

/** The Earth return stage a round-trip Mission's Crew arrive with, if they arrive, keeping what it bought for the way home. */
export function stageArriving(
  rules: Rules,
  mission: PlannedMission | null,
  arrived: { name: string; arrivedOn: string }[],
): EarthReturnStage[] {
  const [first] = arrived;
  const homeward = rules.homewardEventsFor(mission);
  if (!first || homeward.length === 0) return [];
  const homewardIds = new Set(homeward.map(({ id }) => id));
  return [
    {
      arrivedOn: first.arrivedOn,
      crew: arrived.map(({ name }) => name),
      reliability: Object.fromEntries(
        Object.entries(mission?.reliability ?? {}).filter(([eventId]) =>
          homewardIds.has(eventId),
        ),
      ),
      contingencyIds: (mission?.contingencyIds ?? []).filter((id) =>
        rules
          .journeyHomeEvents()
          .some((event) => rules.contingencyFor(mission, event.id)?.id === id),
      ),
    },
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
