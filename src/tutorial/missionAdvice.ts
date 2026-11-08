import type { PlanningTools } from "../balance/strategy";
import type { ProgramView } from "../simulation/simulation";
import {
  assetsWithIds,
  listOf,
  siteName,
  type AdviceItem,
  type PlannedMission,
  type ViewAsset,
} from "./adviceItems";
import type { PlannedAsset } from "../simulation/simulation";
import { baseKinds } from "./base";
import {
  bestActivityReason,
  longestAdds,
  longestCosts,
  longestEarns,
  longestWouldNotPay,
  onlyGrantsPay,
} from "./choiceReasons";
import { baseSite, crewVehicleOf } from "./route";

/* The advice on the Turn's Mission: each choice the tutorial's plan makes for it, and why. */

const isBasePart = ({ kind }: ViewAsset) =>
  (baseKinds as readonly string[]).includes(kind);

const names = (assets: readonly ViewAsset[]) =>
  listOf(assets.map(({ name }) => name));

function launchVehicleItem(
  view: ProgramView,
  mission: PlannedMission,
  aboard: ViewAsset[],
): AdviceItem {
  const vehicle = view.launchVehicles.find(
    ({ id }) => id === mission.launchVehicleId,
  );
  const name = vehicle?.name ?? mission.launchVehicleId;
  const forCrew = crewVehicleOf(view)?.id === mission.launchVehicleId;
  const reason = mission.crew
    ? `A Crewed Mission needs the room only the ${name} has, and Crew fly only on a Launch Vehicle that has flown.`
    : forCrew && vehicle?.technologyReadiness !== "flight-proven"
      ? `The ${name} carries ${names(aboard)} at once, and this first flight makes it Flight-proven, ready for Crew.`
      : forCrew
        ? `The ${name} carries ${names(aboard)} at once.`
        : `It is the cheapest Launch Vehicle that can carry ${names(aboard)}.`;
  return { topic: "launchVehicle", advice: `Launch on the ${name}.`, reason };
}

function assetsReason(aboard: ViewAsset[]): string {
  const parts = aboard.filter(isBasePart);
  if (parts.length === baseKinds.length) {
    return "A fuel plant, a Habitat and a Mars lab operating together at one Landing Site make the Base. Sent together, they start at once and run out of Service Life together.";
  }
  if (parts.length > 0) {
    return `The Base needs a fuel plant, a Habitat and a Mars lab operating together before Crew land, and ${names(parts)} ${parts.length === 1 ? "is" : "are"} missing.`;
  }
  const [main] = aboard;
  if (!main) return "";
  if (main.kind === "rover") {
    return "A rover earns Research Grants on every Turn it operates, and that money pays for everything that comes later.";
  }
  if (main.kind === "orbiter" && main.benefit !== null) {
    return `${main.name} relays for everything on the surface, which raises its Ongoing Research while it operates.`;
  }
  if (main.kind === "orbiter") {
    return `${main.name} can Survey Landing Sites from orbit, which lowers their landing risk for every Mission that lands later.`;
  }
  return main.description;
}

function landingSiteItem(
  view: ProgramView,
  mission: PlannedMission,
): AdviceItem[] {
  const id = mission.landingSiteId;
  if (id === undefined) return [];
  const site = view.landingSites.find((each) => each.id === id);
  const reason = mission.crew
    ? "Crew land at the Base, beside its fuel plant, Habitat and Mars lab."
    : baseSite(view) === id
      ? "It is the Base's Landing Site. Everything the route lands goes there now, where the Mars lab raises the Research Grants of the rovers."
      : site?.surveyed
        ? `A Survey has lowered its landing risk${site.landed ? "" : ", and the first landing there earns Science"}.`
        : "It has the lowest landing risk on offer.";
  return [
    {
      topic: "landingSite",
      advice: `Land at ${siteName(view, id)}.`,
      reason,
    },
  ];
}

function trajectoryItem(
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  const chosen = tools
    .previewTrajectories(mission)
    .find(({ chosen: isChosen }) => isChosen);
  if (!chosen) return [];
  return [
    {
      topic: "trajectory",
      advice: `Fly the ${chosen.name} Trajectory.`,
      reason:
        chosen.costMillions === 0
          ? "It costs nothing extra and leaves the most room for the Mission, and arriving later this Turn costs little."
          : chosen.description,
    },
  ];
}

function serviceLifeItems(
  view: ProgramView,
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  const planned = tools
    .previewAssets(mission)
    .filter(({ serviceLifeOptions }) => serviceLifeOptions.length > 1);
  const kindOf = ({ assetId }: PlannedAsset) =>
    view.assets.find(({ id }) => id === assetId)?.kind ?? "";
  const partOfBase = (asset: PlannedAsset) =>
    (baseKinds as readonly string[]).includes(kindOf(asset));
  const longest = planned.filter(
    ({ serviceLifeDays, serviceLifeOptions }) =>
      serviceLifeDays ===
      Math.max(...serviceLifeOptions.map(({ days }) => days)),
  );
  const short = planned.filter((asset) => !longest.includes(asset));
  const worthLonger = short.filter(
    (asset) => partOfBase(asset) || kindOf(asset) === "rover",
  );
  const enough = short.filter((asset) => !worthLonger.includes(asset));
  const namesOf = (assets: PlannedAsset[]) =>
    listOf(assets.map(({ name }) => name));
  const sentences = (
    assets: PlannedAsset[],
    each: (asset: PlannedAsset) => string,
  ) => assets.map(each).join(" ");
  const items: AdviceItem[] = [];
  if (longest.length > 0) {
    const [part] = longest.filter(partOfBase);
    items.push({
      topic: "serviceLife",
      advice: `Buy the longest Service Life for ${namesOf(longest)}.`,
      reason: part
        ? `The Base counts only while all of it operates, so its parts must last until Crew arrive: ${longestAdds(part)}.`
        : sentences(longest, longestEarns),
    });
  }
  if (worthLonger.length > 0) {
    items.push({
      topic: "serviceLife",
      advice: `Keep the shortest Service Life for ${namesOf(worthLonger)}.`,
      reason: `${sentences(worthLonger, longestCosts)} There isn't the money for a longer one as well this Turn.`,
    });
  }
  if (enough.length > 0) {
    items.push({
      topic: "serviceLife",
      advice: `Keep the shortest Service Life for ${namesOf(enough)}.`,
      reason: `${sentences(enough, longestWouldNotPay)} ${onlyGrantsPay}`,
    });
  }
  return items;
}

function reliabilityItems(
  view: ProgramView,
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  const events = tools.previewMission(mission);
  const levels = events[0]?.reliabilityLevels ?? [];
  const nameOf = (id: string) =>
    levels.find((level) => level.id === id)?.name ?? id;
  const bought = new Set(
    events.map(({ reliabilityLevelId }) => reliabilityLevelId),
  );
  const [level] = [...bought];
  const cheapest = levels.toSorted(
    (first, second) => first.costMillions - second.costMillions,
  )[0]?.id;
  const items: AdviceItem[] = [
    bought.size === 1 && level !== undefined && level !== cheapest
      ? {
          topic: "reliability",
          advice: `Buy ${nameOf(level)} Reliability on every Mission Event.`,
          reason: mission.crew
            ? "Crew fly only with the best Reliability, as nothing the Program has is worth more than they are."
            : "It makes each Mission Event far less likely to fail, which costs much less than losing the Mission.",
        }
      : {
          topic: "reliability",
          advice: "Buy no more Reliability on the Mission Events this Turn.",
          reason:
            "There isn't the money for it as well as the Mission. Buy it on every Mission Event whenever there is.",
        },
  ];
  const reliableAssets = Object.entries(mission.assetChoices ?? {}).filter(
    ([, { reliabilityLevelId }]) =>
      reliabilityLevelId !== undefined && reliabilityLevelId !== cheapest,
  );
  const [assetLevel] = reliableAssets.map(
    ([, { reliabilityLevelId }]) => reliabilityLevelId ?? "",
  );
  if (assetLevel !== undefined) {
    const assets = assetsWithIds(
      view,
      reliableAssets.map(([id]) => id),
    );
    items.push({
      topic: "reliability",
      advice: `Buy ${nameOf(assetLevel)} Reliability for ${names(assets)}.`,
      reason:
        "It lowers their chance of failing in service, so the Base is still whole when Crew arrive.",
    });
  }
  return items;
}

function contingencyItem(
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  const bought = tools
    .previewMission(mission)
    .flatMap(({ contingency }) =>
      contingency?.bought ? [contingency.name] : [],
    );
  if (bought.length === 0) return [];
  return [
    {
      topic: "contingency",
      advice: `Buy the ${listOf(bought)} Contingenc${bought.length === 1 ? "y" : "ies"}.`,
      reason:
        "Each gives a Mission Event that fails a second chance, at a Decision Point, for a little money and mass.",
    },
  ];
}

function newActivityItems(
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  return tools
    .previewAssets(mission)
    .flatMap(({ name, activityId, activities }) => {
      const activity = activities.find(({ id }) => id === activityId);
      if (!activity || activities.length < 2) return [];
      return [
        {
          topic: "activities" as const,
          advice: `Set ${name} to ${activity.name}.`,
          reason: activity.surveys
            ? "Surveying lowers the landing risk at Landing Sites for every later landing, and reveals new ones."
            : bestActivityReason(name, activity, activities),
        },
      ];
    });
}

function crewItems(
  view: ProgramView,
  mission: PlannedMission,
  tools: PlanningTools,
): AdviceItem[] {
  const { crew } = mission;
  if (!crew) return [];
  const planned = tools.previewCrew(mission);
  const where =
    mission.landingSiteId === undefined
      ? "to Mars orbit"
      : `landing at ${siteName(view, mission.landingSiteId)}`;
  const supplies = planned?.supplies.find(({ id }) => id === crew.suppliesId);
  const protection = view.crewedMission.protection.find(
    ({ id }) => id === crew.protectionId,
  );
  return [
    {
      topic: "crew",
      advice: `Send a Crew of ${crew.size}${crew.roundTrip ? " on a round trip" : ""}, ${where}.`,
      reason: `The smallest Crew costs least and puts fewest lives at risk.${
        crew.roundTrip
          ? " A round trip brings an Earth return stage, so they can come home on a later Turn through Mars ascent."
          : ""
      }`,
    },
    ...(supplies
      ? [
          {
            topic: "supplies" as const,
            advice: `Carry ${supplies.name} Supplies.`,
            reason: `They last this Crew ${supplies.days} days from launch: the most that fit and can be paid for beside the Protection.`,
          },
        ]
      : []),
    ...(protection
      ? [
          {
            topic: "protection" as const,
            advice: `Carry ${protection.name} Protection.`,
            reason:
              protection.radiationCutPercent > 0
                ? `It slows the Health they lose to radiation by ${protection.radiationCutPercent}%, on the way there and on the way home.`
                : "There isn't the room or money for any, so they will lose Health to radiation faster.",
          },
        ]
      : []),
  ];
}

/** Each choice the plan makes for its Mission, with why. */
export function missionItems(
  view: ProgramView,
  tools: PlanningTools,
  mission: PlannedMission,
): AdviceItem[] {
  const aboard = assetsWithIds(view, mission.assetIds);
  return [
    launchVehicleItem(view, mission, aboard),
    ...(aboard.length > 0
      ? [
          {
            topic: "assets" as const,
            advice: `Send ${names(aboard)}.`,
            reason: assetsReason(aboard),
          },
        ]
      : []),
    ...crewItems(view, mission, tools),
    ...landingSiteItem(view, mission),
    ...trajectoryItem(mission, tools),
    ...serviceLifeItems(view, mission, tools),
    ...reliabilityItems(view, mission, tools),
    ...contingencyItem(mission, tools),
    ...newActivityItems(mission, tools),
  ];
}
