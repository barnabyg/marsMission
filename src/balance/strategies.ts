import type {
  PlannedActivity,
  PlannedAsset,
  ProgramView,
  Simulation,
  TurnPlan,
} from "../simulation/simulation";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/** What a strategy can ask the Simulation while it plans a Turn. */
export interface PlanningTools {
  previewAssets(mission: PlannedMission): PlannedAsset[];
  previewMission(
    mission: PlannedMission,
  ): ReturnType<Simulation["previewMission"]>;
  /** What's wrong with a plan for this Turn, which is nothing if it can be submitted. */
  problemsWith(plan: TurnPlan): string[];
  /** What a plan for this Turn costs. */
  costOf(plan: TurnPlan): number;
}

/** One way of playing the game. It sees what a player sees, so it can't know the seed or what will happen. */
export interface Strategy {
  name: string;
  description: string;
  plan(view: ProgramView, tools: PlanningTools): TurnPlan;
}

type Aim = "science" | "grants";

/** A strategy that launches one Mission with one Asset on every Turn that it can, up to any limit of Assets. */
interface Campaign {
  /** The kinds of Asset to try sending this Turn, best first. */
  order(view: ProgramView): string[];
  /** What Assets on the surface and orbiters doing research aim for, which can change as the Program goes on. */
  aim: Aim | ((view: ProgramView) => Aim);
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
}

const surveyActivity = (activities: PlannedActivity[]) =>
  activities.find(({ surveys }) => surveys);

const canSurvey = (activities: PlannedActivity[]) =>
  surveyActivity(activities) !== undefined;

const surveyorInService = (view: ProgramView) =>
  view.operatingAssets.some(
    ({ activities, daysLeft }) => daysLeft > 0 && canSurvey(activities),
  );

/** An orbiter to Survey whenever none is at work and sites are left, and otherwise these kinds. */
const surveyThenLand = (surfaceKinds: string[]) => (view: ProgramView) =>
  !surveyorInService(view) && view.somethingLeftToSurvey
    ? ["orbiter", ...surfaceKinds]
    : surfaceKinds;

const aimOf = ({ aim }: Campaign, view: ProgramView): Aim =>
  typeof aim === "function" ? aim(view) : aim;

const wantsSurvey = (view: ProgramView, campaign: Campaign) =>
  campaign.surveysFirst &&
  view.somethingLeftToSurvey &&
  (campaign.surveysWhile?.(view) ?? true);

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
function operatingActivities(view: ProgramView, campaign: Campaign) {
  let surveying = false;
  const changes: Record<string, string> = {};
  for (const {
    key,
    activityId,
    activities,
    daysLeft,
  } of view.operatingAssets) {
    const survey: PlannedActivity | undefined =
      !surveying && daysLeft > 0 && wantsSurvey(view, campaign)
        ? surveyActivity(activities)
        : undefined;
    surveying ||= survey !== undefined;
    const wanted =
      survey?.id ?? researchActivity(activities, aimOf(campaign, view))?.id;
    if (wanted !== undefined && wanted !== activityId) changes[key] = wanted;
  }
  return { changes, surveying };
}

/** The site to land at: a new one before one already landed at, a surveyed one before a riskier one, then the most Science. */
function landingSiteFor(view: ProgramView, campaign: Campaign) {
  return view.landingSites
    .filter(({ surveyed }) => surveyed || !campaign.onlySurveyedSites)
    .toSorted(
      (first, second) =>
        Number(first.landed) - Number(second.landed) ||
        Number(second.surveyed) - Number(first.surveyed) ||
        second.science - first.science,
    )[0];
}

/** Ways of sending an Asset of this kind this Turn, from what the Campaign wants most down to the cheapest. */
function missionsFor(
  kind: string,
  view: ProgramView,
  tools: PlanningTools,
  campaign: Campaign,
  surveying: boolean,
): PlannedMission[] {
  const asset = view.assets.find((candidate) => candidate.kind === kind);
  if (!asset) return [];
  const vehicle = view.launchVehicles
    .filter(({ capacityTonnes }) => capacityTonnes >= asset.massTonnes)
    .toSorted((first, second) => first.costMillions - second.costMillions)[0];
  if (!vehicle) return [];
  const site = asset.landsAtSite ? landingSiteFor(view, campaign) : undefined;
  if (asset.landsAtSite && !site) return [];

  const mission: PlannedMission = {
    launchVehicleId: vehicle.id,
    assetIds: [asset.id],
    ...(site ? { landingSiteId: site.id } : {}),
  };
  const planned = tools.previewAssets(mission)[0];
  if (!planned) return [];

  const survey =
    !surveying && wantsSurvey(view, campaign)
      ? surveyActivity(planned.activities)
      : undefined;
  const activityId =
    survey?.id ??
    researchActivity(planned.activities, aimOf(campaign, view))?.id ??
    planned.activityId;
  // Short of money for a retry, a longer Service Life is the first thing to give up.
  const canSpareMoney =
    view.moneyMillions >= 2 * (campaign.reserveMillions ?? 0);
  const serviceLives =
    (campaign.longestServiceLife === true ||
      (Array.isArray(campaign.longestServiceLife) &&
        campaign.longestServiceLife.includes(kind))) &&
    canSpareMoney
      ? planned.serviceLifeOptions
          .map(({ days }) => days)
          .toSorted((first, second) => second - first)
      : [planned.serviceLifeDays];
  const dearestFirst = planned.reliabilityLevels
    .toSorted((first, second) => second.costMillions - first.costMillions)
    .map(({ id }) => id);
  const assetLevels =
    campaign.assetReliabilityFor?.includes(kind) === false
      ? undefined
      : campaign.assetReliability;
  const levels =
    assetLevels === "cheapest"
      ? dearestFirst.slice(-2)
      : assetLevels === "best" || campaign.missionEventReliability === true
        ? dearestFirst
        : [planned.reliabilityLevelId];
  const events = tools.previewMission(mission);

  return serviceLives.flatMap((serviceLifeDays) =>
    levels.map((level) => ({
      ...mission,
      ...(campaign.missionEventReliability
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
  );
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
const reserveNow = (view: ProgramView, { reserveMillions = 0 }: Campaign) =>
  grantsPerTurn(view) < reserveMillions / 2 &&
  view.moneyMillions >= 2 * reserveMillions
    ? reserveMillions
    : 0;

function campaign(
  name: string,
  description: string,
  chosen: Campaign,
): Strategy {
  return {
    name,
    description,
    plan(view, tools) {
      const { changes, surveying } = operatingActivities(view, chosen);
      const inService = view.operatingAssets.filter(
        ({ daysLeft }) => daysLeft > 0,
      ).length;
      const launching =
        inService < (chosen.assetLimit ?? Infinity) &&
        view.turnNumber <= (chosen.lastLaunchTurn ?? Infinity);
      if (launching) {
        for (const kind of chosen.order(view)) {
          for (const mission of missionsFor(
            kind,
            view,
            tools,
            chosen,
            surveying,
          )) {
            const plan = { mission, operatingActivities: changes };
            const reserve = inService > 0 ? reserveNow(view, chosen) : 0;
            if (
              tools.problemsWith(plan).length === 0 &&
              view.moneyMillions - tools.costOf(plan) >= reserve
            ) {
              return plan;
            }
          }
        }
      }
      return { mission: null, operatingActivities: changes };
    },
  };
}

const surveyingLanders: Campaign = {
  order: surveyThenLand(["lander"]),
  aim: "science",
  surveysFirst: true,
  onlySurveyedSites: true,
};

const surveyingRovers: Campaign = {
  ...surveyingLanders,
  order: surveyThenLand(["rover", "lander"]),
};

/** An orbiter's first Survey, while none has been done and none is under way. */
const orbiterForFirstSurvey = (view: ProgramView) =>
  !surveyorInService(view) &&
  view.landingSites.every(({ surveyed }) => !surveyed)
    ? ["orbiter"]
    : [];

/** This kind of Asset until something has landed, then an orbiter for its Milestone and Surveys, then the same as the others. */
const landThenOrbiter = (kind: string) => (view: ProgramView) => {
  if (!view.landingSites.some(({ landed }) => landed)) return [kind];
  return view.milestones.some(({ id }) => id === "first-orbiter-at-mars")
    ? ["rover", "lander"]
    : ["orbiter"];
};

/**
 * Plays as a careful player would: one orbiter to Survey, then rovers, keeping money back for a retry and
 * launching only to keep a few Assets operating. The strategies built on it differ from it in one choice.
 */
const steadyRovers: Campaign = {
  order: (view) => [...orbiterForFirstSurvey(view), "rover", "lander"],
  aim: "grants",
  surveysFirst: true,
  onlySurveyedSites: true,
  longestServiceLife: ["rover"],
  assetLimit: 3,
  reserveMillions: 1000,
};

/** Every strategy the report covers. Add one here and it needs nothing else. */
export const strategies: Strategy[] = [
  {
    name: "launch nothing",
    description: "Never launches, so shows how fast Public Support fades.",
    plan: () => ({ mission: null }),
  },
  campaign(
    "survey first",
    "An orbiter that Surveys while there is anything left to Survey, otherwise landers at surveyed sites.",
    surveyingLanders,
  ),
  campaign(
    "land straight away",
    "Landers at unsurveyed sites until one lands, and then the same as survey first.",
    {
      ...surveyingLanders,
      onlySurveyedSites: false,
      order: (view) =>
        view.landingSites.some(({ landed }) => landed)
          ? surveyThenLand(["lander"])(view)
          : ["lander", "orbiter"],
    },
  ),
  campaign(
    "favour Science",
    "Survey first with rovers when it can afford them, on the Activity that earns the most Science.",
    surveyingRovers,
  ),
  campaign(
    "favour Research Grants",
    "Survey first with rovers when it can afford them, on the Activity that pays the most Research Grant.",
    { ...surveyingRovers, aim: "grants" },
  ),
  campaign(
    "longer Service Life",
    "Survey first, buying the longest Service Life it can afford.",
    { ...surveyingLanders, longestServiceLife: true },
  ),
  campaign(
    "Asset Reliability",
    "Survey first, buying the best Reliability for each Asset that it can afford.",
    { ...surveyingLanders, assetReliability: "best" },
  ),
  campaign(
    "Mission Event Reliability",
    "Survey first, buying the best Reliability on every Mission Event that it can afford.",
    { ...surveyingLanders, missionEventReliability: true },
  ),
  campaign(
    "research orbiter, then land",
    "One orbiter on research that never Surveys, then landers at unsurveyed sites.",
    {
      ...surveyingLanders,
      surveysFirst: false,
      onlySurveyedSites: false,
      order: (view) =>
        view.milestones.length === 0 ? ["orbiter", "lander"] : ["lander"],
    },
  ),
  campaign(
    "orbiters: research only",
    "Keeps two orbiters on research and never lands.",
    {
      ...surveyingLanders,
      surveysFirst: false,
      order: () => ["orbiter"],
      assetLimit: 2,
    },
  ),
  campaign(
    "orbiters: Survey first",
    "Keeps two orbiters and never lands. One Surveys until nothing is left to Survey, and the rest do research.",
    { ...surveyingLanders, order: () => ["orbiter"], assetLimit: 2 },
  ),
  campaign(
    "keep two Assets",
    "Survey first with the longest Service Life, launching only to keep two Assets operating, to see what Ongoing Research sustains.",
    { ...surveyingLanders, longestServiceLife: true, assetLimit: 2 },
  ),
  campaign(
    "stop after Turn 4",
    "Survey first with rovers on Research Grants, then launches nothing after Turn 4, to see that a Program with nothing left fades.",
    { ...surveyingRovers, aim: "grants", lastLaunchTurn: 4 },
  ),
  campaign(
    "steady: Soil analysis",
    "One orbiter, then rovers on Soil analysis with the longest Service Life, keeping three Assets and some money back.",
    steadyRovers,
  ),
  campaign("steady: Long traverse", "The same, with rovers on Long traverse.", {
    ...steadyRovers,
    aim: "science",
  }),
  campaign(
    "steady: Soil, traverse when rich",
    "The same, with rovers on Soil analysis until money passes the cost of several rovers, then on Long traverse.",
    {
      ...steadyRovers,
      aim: (view) => (view.moneyMillions >= 5000 ? "science" : "grants"),
    },
  ),
  campaign(
    "steady: shortest Service Life",
    "As steady: Soil analysis, with the shortest Service Life.",
    { ...steadyRovers, longestServiceLife: false },
  ),
  campaign(
    "steady: longest on everything",
    "As steady: Soil analysis, also buying the longest Service Life for orbiters and landers.",
    { ...steadyRovers, longestServiceLife: true },
  ),
  campaign(
    "steady: shortest, Tested",
    "As steady: shortest Service Life, buying the cheapest Reliability for each Asset.",
    {
      ...steadyRovers,
      longestServiceLife: false,
      assetReliability: "cheapest",
    },
  ),
  campaign(
    "steady: Tested rovers",
    "As steady: Soil analysis, buying the cheapest Reliability for each rover.",
    {
      ...steadyRovers,
      assetReliability: "cheapest",
      assetReliabilityFor: ["rover"],
    },
  ),
  campaign(
    "steady: best on rovers",
    "As steady: Soil analysis, buying the best Reliability for each rover that it can afford.",
    {
      ...steadyRovers,
      assetReliability: "best",
      assetReliabilityFor: ["rover"],
    },
  ),
  campaign(
    "steady: Tested everything",
    "As steady: Soil analysis, buying the cheapest Reliability for every Asset, including the orbiter and any lander.",
    { ...steadyRovers, assetReliability: "cheapest" },
  ),
  campaign(
    "steady: land straight away",
    "As steady: Soil analysis, but with no orbiter: a lander goes to an unsurveyed site on the first Turn, then rovers.",
    {
      ...steadyRovers,
      order: landThenOrbiter("lander"),
      onlySurveyedSites: false,
    },
  ),
  campaign(
    "steady: rover straight away",
    "As steady: Soil analysis, but with no orbiter: a rover goes to an unsurveyed site on the first Turn.",
    {
      ...steadyRovers,
      order: landThenOrbiter("rover"),
      onlySurveyedSites: false,
      reserveMillions: 0,
    },
  ),
  campaign(
    "steady: rover at once",
    "As steady: Soil analysis, but keeping no money back, so the first landing is a rover.",
    { ...steadyRovers, reserveMillions: 0 },
  ),
  campaign(
    "steady: Survey once",
    "As steady: Soil analysis, but the orbiter changes to research after its first Survey.",
    {
      ...steadyRovers,
      surveysWhile: (view) =>
        view.landingSites.every(({ surveyed }) => !surveyed),
    },
  ),
];
