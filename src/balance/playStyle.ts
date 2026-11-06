import {
  aimOf,
  canSurvey,
  fuller,
  missionsFor,
  researchActivity,
  surveyActivity,
  wantsSurvey,
} from "./assetMissions";
import { crewedMissions } from "./crewPlay";
import type { PlayStyle } from "./playStyleOptions";
import type { PlanningTools, Strategy } from "./strategy";
import { ending, payUpkeep, toolsEnding } from "./upkeepPlay";
import type {
  PlannedActivity,
  ProgramView,
  TurnPlan,
} from "../simulation/simulation";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

export const surveyorInService = (view: ProgramView) =>
  view.operatingAssets.some(
    ({ activities, daysLeft }) => daysLeft > 0 && canSurvey(activities),
  );

/** An orbiter to Survey whenever none is at work and sites are left, and otherwise these kinds. */
export const surveyThenLand =
  (surfaceKinds: string[]) => (view: ProgramView) =>
    !surveyorInService(view) && view.somethingLeftToSurvey
      ? ["orbiter", ...surfaceKinds]
      : surfaceKinds;

/** New Activities for the Assets operating, and whether one of them is surveying this Turn. */
function operatingActivities(view: ProgramView, playStyle: PlayStyle) {
  let surveying = false;
  const changes: Record<string, string> = {};
  for (const {
    key,
    activityId,
    activities,
    daysLeft,
  } of view.operatingAssets) {
    const survey: PlannedActivity | undefined =
      !surveying && daysLeft > 0 && wantsSurvey(view, playStyle)
        ? surveyActivity(activities)
        : undefined;
    surveying ||= survey !== undefined;
    const wanted =
      survey?.id ?? researchActivity(activities, aimOf(playStyle, view))?.id;
    if (wanted !== undefined && wanted !== activityId) changes[key] = wanted;
  }
  return { changes, surveying };
}

/** The Developments to start this Turn, in the order the PlayStyle lists them, while the money left covers each one. */
function developmentsToStart(
  view: ProgramView,
  playStyle: PlayStyle,
  moneyLeft: number,
): string[] {
  if (!(playStyle.developsWhile?.(view) ?? true)) return [];
  let left = moneyLeft;
  return view.developments
    .filter(
      ({ id, status }) =>
        status === "notStarted" && playStyle.develops?.includes(id),
    )
    .filter(({ costMillions }) => {
      if (costMillions > left) return false;
      left -= costMillions;
      return true;
    })
    .map(({ id }) => id);
}

/** The Research Grants the Assets operating now would pay over a whole Turn. */
const grantsPerTurn = (view: ProgramView) =>
  view.operatingAssets
    .filter(({ daysLeft }) => daysLeft > 0)
    .reduce(
      (total, { activityId, activities }) =>
        total +
        (activities.find(({ id }) => id === activityId)?.earnsPerTurn
          ?.researchGrantMillions ?? 0),
      0,
    );

/** Money to keep back for a retry: none once Research Grants would soon pay for one, or if it couldn't be afforded anyway. */
const reserveNow = (view: ProgramView, { reserveMillions = 0 }: PlayStyle) =>
  grantsPerTurn(view) < reserveMillions / 2 &&
  view.moneyMillions >= 2 * reserveMillions
    ? reserveMillions
    : 0;

/** How many Assets are operating with Service Life left. */
const inService = (view: ProgramView) =>
  view.operatingAssets.filter(({ daysLeft }) => daysLeft > 0).length;

/** Money to keep back this Turn, which is none while nothing is operating. */
const reserveFor = (view: ProgramView, playStyle: PlayStyle) =>
  inService(view) > 0 ? reserveNow(view, playStyle) : 0;

/** The Turn's Mission, if it launches one it can afford while keeping its reserve, and the new Activities. */
function missionPlan(
  view: ProgramView,
  tools: PlanningTools,
  playStyle: PlayStyle,
): TurnPlan {
  const { changes, surveying } = operatingActivities(view, playStyle);
  const launching =
    inService(view) < (playStyle.assetLimit ?? Infinity) &&
    view.turnNumber <= (playStyle.lastLaunchTurn ?? Infinity);
  if (launching) {
    const reserve = reserveFor(view, playStyle);
    const affordable = (mission: PlannedMission) => {
      const plan = { mission, operatingActivities: changes };
      return tools.problemsWith(plan).length === 0 &&
        view.moneyMillions - tools.costOf(plan) >= reserve
        ? plan
        : null;
    };
    for (const mission of playStyle.fliesCrew
      ? crewedMissions(view, tools, playStyle.fliesCrew)
      : []) {
      const plan = affordable(mission);
      if (plan) return plan;
    }
    for (const kind of playStyle.order(view)) {
      for (const mission of missionsFor(
        kind,
        view,
        tools,
        playStyle,
        surveying,
      ).flatMap((each) => [...fuller(each, view, playStyle), each])) {
        const plan = affordable(mission);
        if (plan) return plan;
      }
    }
  }
  return { mission: null, operatingActivities: changes };
}

export function playStyle(
  name: string,
  description: string,
  chosen: PlayStyle,
): Strategy {
  return {
    name,
    description,
    answer: ({ kind }, _, { mission }) =>
      ({
        contingency: chosen.contingencies ?? "use",
        dustStorm: chosen.dustStorms ?? "shelter",
        // A solar particle event only hits the Turn's Mission, so its Crew are aboard if it has any.
        solarParticleEvent:
          (mission?.crew && chosen.fliesCrew?.solarParticleEvents) ??
          chosen.solarParticleEvents ??
          "safeMode",
        goNoGo: chosen.goNoGo ?? "holdOff",
      })[kind],
    plan(given, givenTools) {
      const kept = planPayingUpkeep(given, givenTools, chosen, 0);
      // Only short of money, not holding back at its limit of Assets, which ending one would only churn.
      if (kept.mission || inService(given) >= (chosen.assetLimit ?? Infinity)) {
        return kept;
      }
      // With nothing to launch, ending the missions of the Assets with the least Service Life left may free the Money
      // for one, which is worth more than keeping them.
      for (
        let alsoEnd = 1;
        alsoEnd <= given.operatingAssets.length;
        alsoEnd++
      ) {
        const freed = planPayingUpkeep(given, givenTools, chosen, alsoEnd);
        if (freed.mission) return freed;
      }
      return kept;
    },
  };
}

/** The Turn's plan, paying the upkeep of the Assets it keeps, after ending the missions of `alsoEnd` of them. */
function planPayingUpkeep(
  given: ProgramView,
  givenTools: PlanningTools,
  chosen: PlayStyle,
  alsoEnd: number,
): TurnPlan {
  const { view, endedAssetKeys } = payUpkeep(given, alsoEnd);
  const tools = toolsEnding(givenTools, endedAssetKeys);
  // The reserve for a retry is kept against the Money before upkeep, which comes out of it.
  const style = {
    ...chosen,
    reserveMillions: Math.max(
      0,
      (chosen.reserveMillions ?? 0) -
        (given.moneyMillions - view.moneyMillions),
    ),
  };
  const plan = missionPlan(view, tools, style);
  const left =
    view.moneyMillions - tools.costOf(plan) - reserveFor(view, style);
  const developmentIds = developmentsToStart(view, style, left);
  // Left out when empty, so that a strategy that never develops plans exactly as it did before Development.
  return ending(
    developmentIds.length > 0 ? { ...plan, developmentIds } : plan,
    endedAssetKeys,
  );
}
