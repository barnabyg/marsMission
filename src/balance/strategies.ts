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
}

/** One way of playing the game. It sees what a player sees, so it can't know the seed or what will happen. */
export interface Strategy {
  name: string;
  description: string;
  plan(view: ProgramView, tools: PlanningTools): TurnPlan;
}

/** A strategy that launches one Mission with one Asset on every Turn that it can, up to any limit of Assets. */
interface Campaign {
  /** The kinds of Asset to try sending this Turn, best first. */
  order(view: ProgramView): string[];
  /** What Assets on the surface and orbiters doing research aim for. */
  aim: "science" | "grants";
  /** Whether an Asset that can Survey does that first, while there is something left to Survey. */
  surveysFirst: boolean;
  /** Whether a lander only goes to a site that a Survey has made safer. */
  onlySurveyedSites: boolean;
  /** Buys the longest Service Life it can afford, rather than the shortest. */
  longestServiceLife?: boolean;
  /** Buys the best Reliability for the Asset it can afford, rather than none. */
  assetReliability?: boolean;
  /** Buys the best Reliability on every Mission Event it can afford, rather than none. */
  missionEventReliability?: boolean;
  /** Launches only while fewer than this many Assets are operating. */
  assetLimit?: number;
}

// The views don't say which Activity is a Survey, because Planning Mode only needs its name.
const surveyActivityId = "survey";

const canSurvey = (activities: PlannedActivity[]) =>
  activities.some(({ id }) => id === surveyActivityId);

/** A Survey covers every known site and reveals another, so once all are surveyed there is no site left to reveal. */
const somethingLeftToSurvey = (view: ProgramView) =>
  view.landingSites.some(({ surveyed }) => !surveyed);

const surveyorInService = (view: ProgramView) =>
  view.operatingAssets.some(
    ({ activities, daysLeft }) => daysLeft > 0 && canSurvey(activities),
  );

/** An orbiter to Survey whenever none is at work and sites are left, and otherwise these kinds. */
const surveyThenLand = (surfaceKinds: string[]) => (view: ProgramView) =>
  !surveyorInService(view) && somethingLeftToSurvey(view)
    ? ["orbiter", ...surfaceKinds]
    : surfaceKinds;

function researchActivity(
  activities: PlannedActivity[],
  aim: Campaign["aim"],
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
    const surveys: boolean =
      campaign.surveysFirst &&
      !surveying &&
      daysLeft > 0 &&
      somethingLeftToSurvey(view) &&
      canSurvey(activities);
    surveying ||= surveys;
    const wanted = surveys
      ? surveyActivityId
      : researchActivity(activities, campaign.aim)?.id;
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

  const surveys =
    campaign.surveysFirst &&
    !surveying &&
    somethingLeftToSurvey(view) &&
    canSurvey(planned.activities);
  const activityId = surveys
    ? surveyActivityId
    : (researchActivity(planned.activities, campaign.aim)?.id ??
      planned.activityId);
  const serviceLives = campaign.longestServiceLife
    ? planned.serviceLifeOptions
        .map(({ days }) => days)
        .toSorted((first, second) => second - first)
    : [planned.serviceLifeDays];
  const buysReliability =
    campaign.assetReliability === true ||
    campaign.missionEventReliability === true;
  const levels = buysReliability
    ? planned.reliabilityLevels
        .toSorted((first, second) => second.costMillions - first.costMillions)
        .map(({ id }) => id)
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
          ...(campaign.assetReliability ? { reliabilityLevelId: level } : {}),
        },
      },
    })),
  );
}

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
      if (inService < (chosen.assetLimit ?? Infinity)) {
        for (const kind of chosen.order(view)) {
          for (const mission of missionsFor(
            kind,
            view,
            tools,
            chosen,
            surveying,
          )) {
            const plan = { mission, operatingActivities: changes };
            if (tools.problemsWith(plan).length === 0) return plan;
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
    { ...surveyingLanders, assetReliability: true },
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
];
