import { crewedMissions } from "./crewPlay";
import {
  canFly,
  type DecisionAnswer,
  type DecisionPoint,
  type PlannedActivity,
  type PlannedAsset,
  type PlannedCrew,
  type PlannedTrajectory,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/** What a strategy can ask the Simulation while it plans a Turn. */
export interface PlanningTools {
  previewAssets(mission: PlannedMission): PlannedAsset[];
  previewMission(
    mission: PlannedMission,
  ): ReturnType<Simulation["previewMission"]>;
  previewTrajectories(mission: PlannedMission): PlannedTrajectory[];
  previewCrew(mission: PlannedMission): PlannedCrew | null;
  /** What's wrong with a plan for this Turn, which is nothing if it can be submitted. */
  problemsWith(plan: TurnPlan): string[];
  /** What a plan for this Turn costs, with any Development it starts. */
  costOf(plan: TurnPlan): number;
}

/** One way of playing the game. It sees what a player sees, so it can't know the seed or what will happen. */
export interface Strategy {
  name: string;
  description: string;
  plan(view: ProgramView, tools: PlanningTools): TurnPlan;
  /** What it does at a Decision Point. It takes the first choice offered unless it says otherwise. */
  answer?(decisionPoint: DecisionPoint, view: ProgramView): DecisionAnswer;
}

type Aim = "science" | "grants";

/** A strategy that launches one Mission with one Asset on every Turn that it can, up to any limit of Assets. */
export interface PlayStyle {
  /** The kinds of Asset to try sending this Turn, best first. */
  order(view: ProgramView): string[];
  /** Assets, by id, to send in place of the first of their kind, whether or not they are Flight-proven yet, when it can afford them. */
  prefers?: string[] | ((view: ProgramView) => string[]);
  /** What Assets on the surface and orbiters doing research aim for, which can change as the Program goes on. */
  aim: Aim | ((view: ProgramView) => Aim);
  /**
   * A Launch Vehicle, by id, to fly once it is built, carrying one more Asset of each other kind it would send this
   * Turn, as many as fit and it can afford, in place of a Mission with one Asset on the cheapest that can carry it.
   */
  fillsVehicle?: string;
  /** Fills that Launch Vehicle only while this is true. */
  fillsWhile?: (view: ProgramView) => boolean;
  /** Technologies, by id, whose Development it starts as soon as it can afford it on top of the Turn's Mission, keeping any reserve. */
  develops?: string[];
  /** Starts that Development only while this is true. */
  developsWhile?: (view: ProgramView) => boolean;
  /** Sends a Crewed Mission to Mars orbit, of the largest Crew it can afford, before any Asset, whenever one can fly. */
  fliesCrew?: boolean;
  /** Lands that Crew at a surveyed Landing Site, once there is one, rather than keeping them in Mars orbit. */
  landsCrew?: boolean;
  /** Whether an Asset that can Survey does that first, while there is something left to Survey. */
  surveysFirst: boolean;
  /** Stops Surveying sooner than when nothing is left to Survey, once this is no longer true. */
  surveysWhile?: (view: ProgramView) => boolean;
  /** Whether a lander only goes to a site that a Survey has made safer. */
  onlySurveyedSites: boolean;
  /** Buys the longest Service Life it can afford, rather than the shortest, on every Asset or these kinds. */
  longestServiceLife?: boolean | string[];
  /** Buys Reliability for the Asset: the best it can afford, or only the cheapest level there is above none. */
  assetReliability?: "best" | "cheapest";
  /** Buys that Reliability only for these kinds of Asset, rather than for every Asset. */
  assetReliabilityFor?: string[];
  /** Buys the best Reliability on every Mission Event it can afford, rather than none. */
  missionEventReliability?: boolean;
  /** Launches only while fewer than this many Assets are operating. */
  assetLimit?: number;
  /** Keeps this much for a retry whenever an Asset is already operating, until Research Grants would pay for one. */
  reserveMillions?: number;
  /** Launches nothing after this Turn. */
  lastLaunchTurn?: number;
  /** Buys every Contingency this Mission can have and afford, and what it does when one could be used. */
  contingencies?: DecisionAnswer;
  /** Buys those Contingencies only while this is true. */
  contingenciesWhile?: (view: ProgramView) => boolean;
  /** The Trajectory it flies, when a Mission can have it and afford it. */
  trajectory?: string;
  /** Flies that Trajectory only while this is true. */
  trajectoryWhile?: (view: ProgramView) => boolean;
  /** What it does at a dust storm, which is to shelter unless it says otherwise. */
  dustStorms?: "shelter" | "carryOn";
  /** What it does at a solar particle event, which is safe mode unless it says otherwise. */
  solarParticleEvents?: "safeMode" | "carryOn";
  /** What it does at a go/no-go check before a landing, which is to hold off unless it says otherwise. */
  goNoGo?: "go" | "holdOff";
}

const surveyActivity = (activities: PlannedActivity[]) =>
  activities.find(({ surveys }) => surveys);

const canSurvey = (activities: PlannedActivity[]) =>
  surveyActivity(activities) !== undefined;

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

const preferredIds = (view: ProgramView, { prefers = [] }: PlayStyle) =>
  typeof prefers === "function" ? prefers(view) : prefers;

const aimOf = ({ aim }: PlayStyle, view: ProgramView): Aim =>
  typeof aim === "function" ? aim(view) : aim;

const wantsSurvey = (view: ProgramView, playStyle: PlayStyle) =>
  playStyle.surveysFirst &&
  view.somethingLeftToSurvey &&
  (playStyle.surveysWhile?.(view) ?? true);

function researchActivity(
  activities: PlannedActivity[],
  aim: Aim,
): PlannedActivity | undefined {
  const score = ({ earnsPerTurn }: PlannedActivity) =>
    aim === "grants"
      ? [earnsPerTurn?.researchGrantMillions ?? 0, earnsPerTurn?.science ?? 0]
      : [earnsPerTurn?.science ?? 0, earnsPerTurn?.researchGrantMillions ?? 0];
  return activities
    .filter(({ earnsPerTurn }) => earnsPerTurn)
    .toSorted((first, second) => {
      const [firstMain = 0, firstOther = 0] = score(first);
      const [secondMain = 0, secondOther = 0] = score(second);
      return secondMain - firstMain || secondOther - firstOther;
    })[0];
}

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

/** The site to land at: a new one before one already landed at, a surveyed one before a riskier one, then the most Science. */
function landingSiteFor(view: ProgramView, playStyle: PlayStyle) {
  return view.landingSites
    .filter(({ surveyed }) => surveyed || !playStyle.onlySurveyedSites)
    .toSorted(
      (first, second) =>
        Number(first.landed) - Number(second.landed) ||
        Number(second.surveyed) - Number(first.surveyed) ||
        second.science - first.science,
    )[0];
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

/** Ways of sending an Asset of this kind this Turn, from what the PlayStyle wants most down to the cheapest. */
function missionsFor(
  kind: string,
  view: ProgramView,
  tools: PlanningTools,
  playStyle: PlayStyle,
  surveying: boolean,
): PlannedMission[] {
  const ofKind = view.assets.filter(
    (candidate) => candidate.kind === kind && canFly(candidate),
  );
  const preferred = ofKind.filter(({ id }) =>
    preferredIds(view, playStyle).includes(id),
  );
  const assets = new Set([...preferred, ...ofKind.slice(0, 1)]);
  return [...assets].flatMap((asset) =>
    missionsForAsset(asset, view, tools, playStyle, surveying),
  );
}

/** Ways of sending this Asset this Turn, from what the PlayStyle wants most down to the cheapest. */
function missionsForAsset(
  asset: ProgramView["assets"][number],
  view: ProgramView,
  tools: PlanningTools,
  playStyle: PlayStyle,
  surveying: boolean,
): PlannedMission[] {
  const { kind } = asset;
  const vehicle = view.launchVehicles
    .filter(
      (candidate) =>
        candidate.capacityTonnes >= asset.massTonnes && canFly(candidate),
    )
    .toSorted((first, second) => first.costMillions - second.costMillions)[0];
  if (!vehicle) return [];
  const site = asset.landsAtSite ? landingSiteFor(view, playStyle) : undefined;
  if (asset.landsAtSite && !site) return [];

  const mission: PlannedMission = {
    launchVehicleId: vehicle.id,
    assetIds: [asset.id],
    ...(site ? { landingSiteId: site.id } : {}),
  };
  const planned = tools.previewAssets(mission)[0];
  if (!planned) return [];

  const survey =
    !surveying && wantsSurvey(view, playStyle)
      ? surveyActivity(planned.activities)
      : undefined;
  const activityId =
    survey?.id ??
    researchActivity(planned.activities, aimOf(playStyle, view))?.id ??
    planned.activityId;
  // Short of money for a retry, a longer Service Life is the first thing to give up.
  const canSpareMoney =
    view.moneyMillions >= 2 * (playStyle.reserveMillions ?? 0);
  const serviceLives =
    (playStyle.longestServiceLife === true ||
      (Array.isArray(playStyle.longestServiceLife) &&
        playStyle.longestServiceLife.includes(kind))) &&
    canSpareMoney
      ? planned.serviceLifeOptions
          .map(({ days }) => days)
          .toSorted((first, second) => second - first)
      : [planned.serviceLifeDays];
  const dearestFirst = planned.reliabilityLevels
    .toSorted((first, second) => second.costMillions - first.costMillions)
    .map(({ id }) => id);
  const assetLevels =
    playStyle.assetReliabilityFor?.includes(kind) === false
      ? undefined
      : playStyle.assetReliability;
  const levels =
    assetLevels === "cheapest"
      ? dearestFirst.slice(-2)
      : assetLevels === "best" || playStyle.missionEventReliability === true
        ? dearestFirst
        : [planned.reliabilityLevelId];
  const events = tools.previewMission(mission);

  const contingencyIds =
    playStyle.contingencies && (playStyle.contingenciesWhile?.(view) ?? true)
      ? events.flatMap(({ contingency }) =>
          contingency ? [contingency.id] : [],
        )
      : [];
  const { trajectory } = playStyle;
  const trajectoryChoice =
    trajectory !== undefined &&
    (playStyle.trajectoryWhile?.(view) ?? true) &&
    tools.previewTrajectories(mission).some(({ id }) => id === trajectory)
      ? { trajectoryId: trajectory }
      : {};
  // Every Contingency, then one at a time from the last Mission Event back, for when they don't all fit.
  const contingencySets =
    contingencyIds.length > 1
      ? [contingencyIds, ...contingencyIds.toReversed().map((id) => [id])]
      : [contingencyIds];
  const extras = contingencySets
    .map((ids): Partial<PlannedMission> => ({
      ...(ids.length > 0 ? { contingencyIds: ids } : {}),
      ...trajectoryChoice,
    }))
    .filter((extra) => Object.keys(extra).length > 0);
  // Without them comes last, for when they cost too much for this Program.
  const choices = [...extras, {}];
  return choices.flatMap((extra) =>
    serviceLives.flatMap((serviceLifeDays) =>
      levels.map((level) => ({
        ...mission,
        ...extra,
        ...(playStyle.missionEventReliability
          ? {
              reliability: Object.fromEntries(
                events.map(({ eventId }) => [eventId, level]),
              ),
            }
          : {}),
        assetChoices: {
          [asset.id]: {
            activityId,
            serviceLifeDays,
            ...(assetLevels ? { reliabilityLevelId: level } : {}),
          },
        },
      })),
    ),
  );
}

/**
 * The Mission on the PlayStyle's big Launch Vehicle, once it is built, with one more Asset of each other kind it sends,
 * most first, then with fewer as they stop fitting. None if it has no such Launch Vehicle.
 */
function fuller(
  mission: PlannedMission,
  view: ProgramView,
  playStyle: PlayStyle,
): PlannedMission[] {
  const vehicle = view.launchVehicles.find(
    ({ id }) => id === playStyle.fillsVehicle,
  );
  if (!vehicle || !canFly(vehicle) || !(playStyle.fillsWhile?.(view) ?? true)) {
    return [];
  }
  const onBoard = view.assets.filter(({ id }) => mission.assetIds.includes(id));
  const site =
    mission.landingSiteId ?? landingSiteFor(view, playStyle)?.id ?? null;
  const extras = playStyle.order(view).flatMap((kind) => {
    if (onBoard.some((asset) => asset.kind === kind)) return [];
    const ofKind = view.assets.filter(
      (asset) =>
        asset.kind === kind &&
        canFly(asset) &&
        (!asset.landsAtSite || site !== null),
    );
    const asset =
      ofKind.find(({ id }) => preferredIds(view, playStyle).includes(id)) ??
      ofKind[0];
    return asset ? [asset] : [];
  });
  return extras
    .map((_, index) => extras.slice(0, extras.length - index))
    .map((added) => {
      const lands = [...onBoard, ...added].some(
        ({ landsAtSite }) => landsAtSite,
      );
      return {
        ...mission,
        launchVehicleId: vehicle.id,
        assetIds: [...mission.assetIds, ...added.map(({ id }) => id)],
        ...(lands && site !== null ? { landingSiteId: site } : {}),
      };
    });
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
      ? crewedMissions(view, tools, playStyle.landsCrew)
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
    answer: ({ kind }) =>
      ({
        contingency: chosen.contingencies ?? "use",
        dustStorm: chosen.dustStorms ?? "shelter",
        solarParticleEvent: chosen.solarParticleEvents ?? "safeMode",
        goNoGo: chosen.goNoGo ?? "holdOff",
      })[kind],
    plan(view, tools) {
      const plan = missionPlan(view, tools, chosen);
      const left =
        view.moneyMillions - tools.costOf(plan) - reserveFor(view, chosen);
      const developmentIds = developmentsToStart(view, chosen, left);
      // Left out when empty, so that a strategy that never develops plans exactly as it did before Development.
      return developmentIds.length > 0 ? { ...plan, developmentIds } : plan;
    },
  };
}
