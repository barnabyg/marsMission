import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import type { CrewAtWork } from "./crewAtMars";
import { raisedStretches, splitByRaise, type Stretch } from "./benefits";
import { sum, type Activity, type Rules } from "./rules";
import type { PlannedActivity } from "./previews";
import type { OngoingResearchEarned, TurnSummary } from "./turnSummary";

interface Earnings {
  science: number;
  publicSupport: number;
  grantMillions: number;
}

const nothingEarned: Earnings = {
  science: 0,
  publicSupport: 0,
  grantMillions: 0,
};

/** The Research Grant for this Science, in whole millions, which can round to nothing. */
function researchGrantFor(
  catalogue: Catalogue,
  researchKind: string,
  science: number,
): number {
  const kind = catalogue.researchKinds.find(({ id }) => id === researchKind);
  return Math.round(science * (kind?.grantMillionsPerScience ?? 0));
}

/** How much a stretch of days counts for: a hundred a day, and a hundred plus its percentage a raised day, so sums stay whole. */
const weightOf = ({
  fromDay,
  toDay,
  percent,
}: {
  fromDay: number;
  toDay: number;
  percent: number;
}) => (toDay - fromDay) * (100 + percent);

/**
 * What an Activity earns over these stretches of a Turn, each at its usual rate raised by its percentage, which is
 * nothing if it isn't research. The Science and Public Support are rounded up once for them all.
 */
function earningsFor(
  catalogue: Catalogue,
  activity: Activity | undefined,
  stretches: { fromDay: number; toDay: number; percent: number }[],
): Earnings {
  const weight = sum(stretches.map(weightOf));
  if (activity?.effect.kind !== "research" || weight <= 0) {
    return nothingEarned;
  }
  const { sciencePerTurn, publicSupportPerTurn, researchKind } =
    activity.effect;
  const forDays = (perTurn: number) =>
    Math.ceil(
      (perTurn * weight) / (100 * catalogue.program.launchWindowIntervalDays),
    );
  const science = forDays(sciencePerTurn);
  return {
    science,
    publicSupport: forDays(publicSupportPerTurn),
    grantMillions: researchGrantFor(catalogue, researchKind, science),
  };
}

/** What an Activity earns over a whole Turn in service if it's research, raised by this percentage. */
export function earningsPerTurn(
  catalogue: Catalogue,
  activity: Activity,
  percent = 0,
): PlannedActivity["earnsPerTurn"] {
  if (activity.effect.kind !== "research") return null;
  const toDay = catalogue.program.launchWindowIntervalDays;
  const { science, publicSupport, grantMillions } = earningsFor(
    catalogue,
    activity,
    [{ fromDay: 0, toDay, percent }],
  );
  return { science, publicSupport, researchGrantMillions: grantMillions };
}

/** The parts of a stay in service that aren't spent sheltering. */
function daysWorking({
  fromDay,
  untilDay,
  shelter,
}: AssetInService & { untilDay: number }): { from: number; to: number }[] {
  const whole = [{ from: fromDay, to: untilDay }];
  if (!shelter) return whole;
  return [
    { from: fromDay, to: Math.min(untilDay, shelter.fromDay) },
    { from: Math.max(fromDay, shelter.toDay), to: untilDay },
  ].filter(({ from, to }) => to > from);
}

/**
 * What one Asset earns this Turn for its days in service less any it spends sheltering, at the raised rate on days
 * that `raised` covers if it is on the surface, and what it would have earned with nothing raised.
 */
export function earningsOfStay(
  catalogue: Catalogue,
  rules: Rules,
  stay: AssetInService,
  raised: Stretch[],
) {
  const activity = rules.activityById(stay.asset.activityId);
  const stretches = daysWorking({
    ...stay,
    untilDay: stay.untilDay ?? catalogue.program.launchWindowIntervalDays,
  }).flatMap(({ from, to }) =>
    splitByRaise(from, to, stay.asset.landingSiteId === null ? [] : raised),
  );
  return {
    activity,
    stretches,
    earned: earningsFor(catalogue, activity, stretches),
    usual: earningsFor(
      catalogue,
      activity,
      stretches.map((stretch) => ({ ...stretch, percent: 0 })),
    ),
  };
}

/** What Benefits added to an Asset's research, which is left out if they raised none of its days. */
function benefitPart(
  stretches: Stretch[],
  earned: Earnings,
  usual: Earnings,
): Pick<OngoingResearchEarned, "benefit"> {
  const raised = stretches.filter(({ percent }) => percent > 0);
  if (raised.length === 0) return {};
  return {
    benefit: {
      givenBy: [...new Set(raised.flatMap(({ givenBy }) => givenBy))],
      days: sum(raised.map(({ fromDay, toDay }) => toDay - fromDay)),
      science: earned.science - usual.science,
      publicSupport: earned.publicSupport - usual.publicSupport,
    },
  };
}

/**
 * What the Crew in one place earn this Turn, if their Activity is research: its rate for each Crew member, for their
 * days there, rounded up for each of them. Nothing raises it yet.
 */
function crewResearch(
  catalogue: Catalogue,
  rules: Rules,
  { name, activityId, stays }: CrewAtWork,
) {
  const activity = rules.activityById(activityId);
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const each = stays.flatMap(({ fromDay, untilDay }) => {
    const toDay = untilDay ?? turnDays;
    if (toDay <= fromDay) return [];
    const stretches = [{ fromDay, toDay, percent: 0, givenBy: [] }];
    return [{ stretches, earned: earningsFor(catalogue, activity, stretches) }];
  });
  const days = Math.max(
    0,
    ...each.flatMap(({ stretches }) =>
      stretches.map(({ fromDay, toDay }) => toDay - fromDay),
    ),
  );
  if (activity?.effect.kind !== "research" || days <= 0) return [];
  const total = (part: keyof Earnings) =>
    sum(each.map(({ earned }) => earned[part]));
  const research: OngoingResearchEarned = {
    assetName: name,
    activityName: activity.name,
    science: total("science"),
    publicSupport: total("publicSupport"),
    days,
  };
  const grant = { name, millions: total("grantMillions") };
  return [
    { research, grant, stretches: each.flatMap(({ stretches }) => stretches) },
  ];
}

/**
 * What each Asset doing research earns this Turn, for its days in service less any it spends sheltering, and the
 * Research Grant that pays. On the surface, it earns at the raised rate on the days a Benefit raises surface research.
 * The Science and Public Support are rounded up for each Asset and Turn, so that a short stint still earns something.
 * The Crew in each place earn it too, at their shared Activity's rate for each of them. It uses no roll, so only the
 * seed, the plan and the answers decide it.
 */
export function carryOutOngoingResearch(
  catalogue: Catalogue,
  rules: Rules,
  inService: AssetInService[],
  crewAtWork: CrewAtWork[] = [],
): {
  earned: OngoingResearchEarned[];
  science: number;
  publicSupport: number;
  researchGrants: TurnSummary["researchGrants"];
  researchGrantMillions: number;
  /** When each Asset earned what it did, which builds up evenly over its days, and faster on raised ones. */
  stints: {
    fromDay: number;
    toDay: number;
    science: number;
    publicSupport: number;
  }[];
} {
  const raised = raisedStretches(catalogue, inService, "surfaceResearch");
  const results = inService.flatMap((stay) => {
    const { activity, stretches, earned, usual } = earningsOfStay(
      catalogue,
      rules,
      stay,
      raised,
    );
    const days = sum(stretches.map(({ fromDay, toDay }) => toDay - fromDay));
    if (activity?.effect.kind !== "research" || days <= 0) return [];
    const research: OngoingResearchEarned = {
      assetName: stay.asset.name,
      activityName: activity.name,
      science: earned.science,
      publicSupport: earned.publicSupport,
      days,
      ...benefitPart(stretches, earned, usual),
    };
    const grant = { name: stay.asset.name, millions: earned.grantMillions };
    return [{ research, grant, stretches }];
  });
  results.push(
    ...crewAtWork.flatMap((crew) => crewResearch(catalogue, rules, crew)),
  );
  const earned = results.map(({ research }) => research);
  const researchGrants = results
    .map(({ grant }) => grant)
    .filter(({ millions }) => millions > 0);
  return {
    earned,
    science: sum(earned.map(({ science }) => science)),
    publicSupport: sum(earned.map(({ publicSupport }) => publicSupport)),
    researchGrants,
    researchGrantMillions: sum(researchGrants.map(({ millions }) => millions)),
    stints: results.flatMap(({ research, stretches }) => {
      const weight = sum(stretches.map(weightOf));
      return stretches.map((stretch) => ({
        fromDay: stretch.fromDay,
        toDay: stretch.toDay,
        science: (research.science * weightOf(stretch)) / weight,
        publicSupport: (research.publicSupport * weightOf(stretch)) / weight,
      }));
    }),
  };
}
