import type { PlanningTools } from "../balance/strategy";
import {
  formatMoney,
  formatTurns,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";
import { bigProgram } from "../balance/styleParts";
import { listOf, type AdviceItem } from "./adviceItems";
import { baseKinds } from "./base";
import { bestActivityReason } from "./choiceReasons";
import { missionItems } from "./missionAdvice";
import {
  baseAtMillions,
  crewVehicleBuilt,
  crewVehicleOf,
  partsMissing,
  savingForCrew,
} from "./route";

/* The advice on everything a plan sets for the Turn besides its Mission's own choices. */

/** Why nothing launches this Turn. */
function noLaunchItem(view: ProgramView): AdviceItem {
  const vehicle = crewVehicleOf(view)?.name ?? "the biggest Launch Vehicle";
  const inService = view.operatingAssets.filter(
    ({ daysLeft }) => daysLeft > 0,
  ).length;
  const money = formatMoney(view.moneyMillions);
  const reason = savingForCrew(view)
    ? `The Base is ready and the ${vehicle} has flown. Crew fly only with the best Reliability on every Mission Event, so save until that can be paid for, from the ${money} there is now.`
    : crewVehicleBuilt(view) && partsMissing(view).length === baseKinds.length
      ? `The whole Base flies together on the ${vehicle}, which needs about ${formatMoney(baseAtMillions)}. There is ${money} now, and Research Grants add to it as the Turn ends.`
      : inService >= (bigProgram.assetLimit ?? Infinity)
        ? `${inService} Assets are operating, which is as many as are worth their Upkeep.`
        : `With ${money} there isn't the money for a rover yet. Research Grants and base funding add to it as the Turn ends.`;
  return {
    topic: "noLaunch",
    advice: savingForCrew(view)
      ? "Launch nothing this Turn: save for the Crewed Mission."
      : "Launch nothing this Turn.",
    reason,
  };
}

function developmentItems(view: ProgramView, plan: TurnPlan): AdviceItem[] {
  const started = view.developments.filter(({ id }) =>
    plan.developmentIds?.includes(id),
  );
  const underWay = view.developments.filter(
    ({ status }) => status === "inProgress",
  );
  return [
    ...started.map(({ name, costMillions, turns }) => ({
      topic: "development" as const,
      advice: `Start the Development of the ${name}.`,
      reason: `Only the ${name} is big enough for Crew or a whole Base. Its Development costs ${formatMoney(costMillions)}, paid now, and takes ${turns} Turns, so start it as soon as the money allows.`,
    })),
    ...underWay.map(({ name, turnsLeft }) => ({
      topic: "development" as const,
      advice: `Let the Development of the ${name} run: it finishes in ${formatTurns(turnsLeft)}.`,
      reason:
        "It is paid for already. Meanwhile the rovers' Research Grants save up for the Base it will carry.",
    })),
  ];
}

function operatingActivityItems(
  view: ProgramView,
  plan: TurnPlan,
): AdviceItem[] {
  return Object.entries(plan.operatingActivities ?? {}).flatMap(
    ([key, activityId]) => {
      const asset = view.operatingAssets.find((each) => each.key === key);
      const activity = asset?.activities.find(({ id }) => id === activityId);
      if (!asset || !activity) return [];
      return [
        {
          topic: "activities" as const,
          advice: `Switch ${asset.name}${asset.landingSiteName ? ` at ${asset.landingSiteName}` : ""} to ${activity.name}.`,
          reason: activity.surveys
            ? "Nothing else is Surveying, and a Survey lowers the landing risk at Landing Sites for every later landing."
            : bestActivityReason(asset.name, activity, asset.activities),
        },
      ];
    },
  );
}

function upkeepItems(view: ProgramView, plan: TurnPlan): AdviceItem[] {
  const ended = view.operatingAssets.filter(({ key }) =>
    plan.endedAssetKeys?.includes(key),
  );
  const kept = view.operatingAssets.filter(
    ({ key, upkeepMillions }) =>
      upkeepMillions > 0 && !plan.endedAssetKeys?.includes(key),
  );
  const upkeep = kept.reduce(
    (total, { upkeepMillions }) => total + upkeepMillions,
    0,
  );
  return [
    ...(ended.length > 0
      ? [
          {
            topic: "upkeep" as const,
            advice: `End the mission of ${listOf(ended.map(({ name }) => name))}.`,
            reason:
              "There isn't the money for all the Upkeep, so the Assets with the least Service Life left stop first.",
          },
        ]
      : []),
    ...(upkeep > 0
      ? [
          {
            topic: "upkeep" as const,
            advice: `Keep ${ended.length > 0 ? "the other" : "every"} Asset at Mars going, for ${formatMoney(upkeep)} of Upkeep.`,
            reason:
              "Each one earning or making up the Base is worth more than its Upkeep.",
          },
        ]
      : []),
  ];
}

function bringHomeItems(view: ProgramView, plan: TurnPlan): AdviceItem[] {
  const place = view.crew.find(({ waysHome }) =>
    waysHome.some(({ key }) => key === plan.bringHome),
  );
  if (!place) return [];
  return [
    {
      topic: "bringHome",
      advice: `Bring the Crew at ${place.locationName} home.`,
      reason:
        "One of them has less than 45 Health or their Supplies wouldn't last another Turn, and the fuel plant has made the ascent propellant they need. Each Crew member home safe earns Public Support.",
    },
  ];
}

/** Each choice a plan makes this Turn, with why, as the tutorial describes it. */
export function itemsFor(
  view: ProgramView,
  tools: PlanningTools,
  plan: TurnPlan,
): AdviceItem[] {
  return [
    ...(plan.mission
      ? missionItems(view, tools, plan.mission)
      : [noLaunchItem(view)]),
    ...developmentItems(view, plan),
    ...operatingActivityItems(view, plan),
    ...upkeepItems(view, plan),
    ...bringHomeItems(view, plan),
  ];
}
