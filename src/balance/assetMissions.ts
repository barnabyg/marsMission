import type { PlanningTools } from "./strategy";
import type { Aim, PlayStyle } from "./playStyleOptions";
import {
  canFly,
  type AssetChoices,
  type PlannedActivity,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";

/* The Missions a play style would send with its Assets: which Asset, where it lands, and what it buys for it. */

type PlannedMission = NonNullable<TurnPlan["mission"]>;

export const surveyActivity = (activities: PlannedActivity[]) =>
  activities.find(({ surveys }) => surveys);

export const canSurvey = (activities: PlannedActivity[]) =>
  surveyActivity(activities) !== undefined;

const preferredIds = (view: ProgramView, { prefers = [] }: PlayStyle) =>
  typeof prefers === "function" ? prefers(view) : prefers;

export const aimOf = ({ aim }: PlayStyle, view: ProgramView): Aim =>
  typeof aim === "function" ? aim(view) : aim;

export const wantsSurvey = (view: ProgramView, playStyle: PlayStyle) =>
  playStyle.surveysFirst &&
  view.somethingLeftToSurvey &&
  (playStyle.surveysWhile?.(view) ?? true);

export function researchActivity(
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

/** The Activity that caches samples, among these, if one does. */
export const cachingActivity = (activities: PlannedActivity[]) =>
  activities.find(({ cachesPerTurn }) => cachesPerTurn !== null);

/** The Landing Sites, by id, where an Asset of this kind operates with Service Life left. */
const sitesWith = (view: ProgramView, kind: string) =>
  new Set(
    view.operatingAssets.flatMap(({ kind: each, landingSiteId, daysLeft }) =>
      each === kind && daysLeft > 0 && landingSiteId !== null
        ? [landingSiteId]
        : [],
    ),
  );

/** Whether an ascent vehicle operates with Service Life left at this Landing Site, so that samples there can go home. */
export const ascentVehicleAt = (view: ProgramView, siteId: string | null) =>
  siteId !== null && sitesWith(view, "ascent-vehicle").has(siteId);

/** Where an ascent vehicle would go: the Landing Site with the most samples and none there, if any has samples. */
export function siteNeedingAscent(view: ProgramView) {
  const lifted = sitesWith(view, "ascent-vehicle");
  return view.landingSites
    .filter(({ id, samples }) => !lifted.has(id) && samples > 0)
    .toSorted((first, second) => second.samples - first.samples)[0];
}

/**
 * The rover, by its key, that caches samples while the Program is rich, when the PlayStyle caches them: the first
 * operating with Service Life left. Rovers beside an ascent vehicle cache them too.
 */
export const richCacher = (view: ProgramView, playStyle: PlayStyle) =>
  playStyle.cachesSamples && view.moneyMillions >= richMillions
    ? view.operatingAssets.find(
        ({ kind, daysLeft }) => kind === "rover" && daysLeft > 0,
      )?.key
    : undefined;

/** The Money above which a Program is rich enough for the dearer choices: several rovers' worth. */
export const richMillions = 5000;

/**
 * The site to land at: the PlayStyle's base, if it has one, and otherwise a new one before one already landed at, a
 * surveyed one before a riskier one, then the most Science. A Mars lab goes where its Benefit tag says it would add
 * most, if it would add anything, and an ascent vehicle where samples wait without one.
 */
function landingSiteFor(
  view: ProgramView,
  playStyle: PlayStyle,
  asset?: ProgramView["assets"][number],
) {
  const baseId = playStyle.baseSite?.(view);
  const base = view.landingSites.find(({ id }) => id === baseId);
  if (base) return base;
  const besideRovers = asset?.grantImpact?.landingSiteName;
  const labSite = view.landingSites.find(({ name }) => name === besideRovers);
  if (labSite) return labSite;
  if (asset?.kind === "ascent-vehicle") return siteNeedingAscent(view);
  return view.landingSites
    .filter(({ surveyed }) => surveyed || !playStyle.onlySurveyedSites)
    .toSorted(
      (first, second) =>
        Number(first.landed) - Number(second.landed) ||
        Number(second.surveyed) - Number(first.surveyed) ||
        second.science - first.science,
    )[0];
}

/** Ways of sending an Asset of this kind this Turn, from what the PlayStyle wants most down to the cheapest. */
export function missionsFor(
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
  const site = asset.landsAtSite
    ? landingSiteFor(view, playStyle, asset)
    : undefined;
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
    (playStyle.cachesSamples && ascentVehicleAt(view, site?.id ?? null)
      ? cachingActivity(planned.activities)?.id
      : undefined) ??
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
export function fuller(
  mission: PlannedMission,
  view: ProgramView,
  playStyle: PlayStyle,
  tools: PlanningTools,
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
    .flatMap((added) => {
      const lands = [...onBoard, ...added].some(
        ({ landsAtSite }) => landsAtSite,
      );
      const filled = {
        ...mission,
        launchVehicleId: vehicle.id,
        assetIds: [...mission.assetIds, ...added.map(({ id }) => id)],
        ...(lands && site !== null ? { landingSiteId: site } : {}),
      };
      const reliable = reliableThroughout(filled, mission, tools);
      const well = builtWell(reliable, added, playStyle, tools);
      return well === reliable ? [reliable] : [well, reliable];
    });
}

/**
 * The filled Mission with the Reliability its first Asset's Mission bought on each Mission Event also bought on those the
 * bigger Launch Vehicle adds, or the same Mission if it bought none.
 */
function reliableThroughout(
  filled: PlannedMission,
  mission: PlannedMission,
  tools: PlanningTools,
): PlannedMission {
  const level = Object.values(mission.reliability ?? {})[0];
  if (level === undefined) return filled;
  return {
    ...filled,
    reliability: Object.fromEntries(
      tools.previewMission(filled).map(({ eventId }) => [eventId, level]),
    ),
  };
}

/**
 * The filled Mission with the longest Service Life and the best Reliability for each Asset it added of the kinds the
 * PlayStyle builds well, or the same Mission if it added none.
 */
function builtWell(
  mission: PlannedMission,
  added: ProgramView["assets"],
  { buildsWell = [] }: PlayStyle,
  tools: PlanningTools,
): PlannedMission {
  const ids = added
    .filter(({ kind }) => buildsWell.includes(kind))
    .map(({ id }) => id);
  if (ids.length === 0) return mission;
  const choices = tools
    .previewAssets(mission)
    .filter(({ assetId }) => ids.includes(assetId))
    .map(
      ({
        assetId,
        serviceLifeOptions,
        reliabilityLevels,
      }): [string, AssetChoices] => [
        assetId,
        {
          serviceLifeDays: Math.max(
            ...serviceLifeOptions.map(({ days }) => days),
          ),
          reliabilityLevelId:
            reliabilityLevels.toSorted(
              (first, second) => second.costMillions - first.costMillions,
            )[0]?.id ?? "none",
        },
      ],
    );
  return {
    ...mission,
    assetChoices: { ...mission.assetChoices, ...Object.fromEntries(choices) },
  };
}
