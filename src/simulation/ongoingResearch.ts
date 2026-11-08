import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import type { CrewAtWork } from "./crewAtMars";
import {
  grantRaisedStretches,
  raisedStretches,
  splitByRaise,
  type Stretch,
} from "./benefits";
import { sum, type Activity, type Rules } from "./rules";
import type { PlannedActivity } from "./previews";
import type {
  OngoingResearchEarned,
  ResearchGrantPaid,
  TurnSummary,
} from "./turnSummary";

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

/**
 * The Research Grant for this Science, in whole millions, which can round to nothing, with its rate raised by this
 * share on average, as a Mars lab raises it.
 */
function researchGrantFor(
  catalogue: Catalogue,
  researchKind: string,
  science: number,
  raisedShare = 1,
): number {
  const kind = catalogue.researchKinds.find(({ id }) => id === researchKind);
  return Math.round(
    science * (kind?.grantMillionsPerScience ?? 0) * raisedShare,
  );
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
 * How much a Mars lab raises the Research Grant rate over these stretches, on average for the Science earned on each:
 * 1 if it raises none of them, and up to 1 plus its percentage if it raises them all.
 */
function grantShare(
  stretches: { fromDay: number; toDay: number; percent: number }[],
  grantRaised: Stretch[],
): number {
  if (grantRaised.length === 0) return 1;
  const parts = stretches.flatMap((stretch) =>
    splitByRaise(stretch.fromDay, stretch.toDay, grantRaised).map((part) => ({
      weight: weightOf({ ...part, percent: stretch.percent }),
      grantPercent: part.percent,
    })),
  );
  const weight = sum(parts.map((part) => part.weight));
  return weight > 0
    ? sum(parts.map((part) => part.weight * (100 + part.grantPercent))) /
        (100 * weight)
    : 1;
}

/**
 * What an Activity earns over these stretches of a Turn, each at its usual rate raised by its percentage, which is
 * nothing if it isn't research. The Science and Public Support are rounded up once for them all. Its Research Grant
 * rate is raised on the days in `grantRaised`, which a Mars lab raises.
 */
function earningsFor(
  catalogue: Catalogue,
  activity: Activity | undefined,
  stretches: { fromDay: number; toDay: number; percent: number }[],
  grantRaised: Stretch[] = [],
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
    grantMillions: researchGrantFor(
      catalogue,
      researchKind,
      science,
      grantShare(stretches, grantRaised),
    ),
  };
}

/**
 * What an Activity earns over a whole Turn in service if it's research, raised by this percentage, with its Research
 * Grant rate raised by `grantPercent`, as a Mars lab raises it.
 */
export function earningsPerTurn(
  catalogue: Catalogue,
  activity: Activity,
  percent = 0,
  grantPercent = 0,
): PlannedActivity["earnsPerTurn"] {
  if (activity.effect.kind !== "research") return null;
  const toDay = catalogue.program.launchWindowIntervalDays;
  const { science, publicSupport, grantMillions } = earningsFor(
    catalogue,
    activity,
    [{ fromDay: 0, toDay, percent }],
    grantPercent > 0
      ? [{ fromDay: 0, toDay, percent: grantPercent, givenBy: [] }]
      : [],
  );
  return { science, publicSupport, researchGrantMillions: grantMillions };
}

/**
 * The Research Grant an Activity would pay over this many days in service, raised by this percentage, as Planning Mode
 * shows what a longer Service Life would earn. Nothing if it isn't research or pays no Research Grant.
 */
export function grantOverDays(
  catalogue: Catalogue,
  activity: Activity,
  days: number,
  percent = 0,
): number {
  return earningsFor(catalogue, activity, [
    { fromDay: 0, toDay: days, percent },
  ]).grantMillions;
}

/** The parts of a stay at Mars, an Asset's or a Crew member's, that aren't spent sheltering. */
export function daysWorking({
  fromDay,
  untilDay,
  shelter,
}: {
  fromDay: number;
  untilDay: number;
  shelter?: { fromDay: number; toDay: number } | undefined;
}): { from: number; to: number }[] {
  const whole = [{ from: fromDay, to: untilDay }];
  if (!shelter) return whole;
  return [
    { from: fromDay, to: Math.min(untilDay, shelter.fromDay) },
    { from: Math.max(fromDay, shelter.toDay), to: untilDay },
  ].filter(({ from, to }) => to > from);
}

/**
 * What one Asset earns this Turn for its days in service less any it spends sheltering, at the raised rate on days
 * that `raised` covers if it is on the surface, with its Research Grant raised by any Mars lab among `labs` at its
 * Landing Site, and what it would have earned with nothing raised. `unraisedGrantMillions` is its grant with no lab.
 */
export function earningsOfStay(
  catalogue: Catalogue,
  rules: Rules,
  stay: AssetInService,
  raised: Stretch[],
  labs: AssetInService[] = [],
) {
  const activity = rules.activityById(stay.asset.activityId);
  const stretches = daysWorking({
    ...stay,
    untilDay: stay.untilDay ?? catalogue.program.launchWindowIntervalDays,
  }).flatMap(({ from, to }) =>
    splitByRaise(from, to, stay.asset.landingSiteId === null ? [] : raised),
  );
  const grantRaised = grantRaisedStretches(
    catalogue,
    labs,
    stay.asset.landingSiteId,
    { assetKind: stay.asset.kind },
  );
  return {
    activity,
    stretches,
    grantRaised,
    earned: earningsFor(catalogue, activity, stretches, grantRaised),
    unraisedGrantMillions: earningsFor(catalogue, activity, stretches)
      .grantMillions,
    usual: earningsFor(
      catalogue,
      activity,
      stretches.map((stretch) => ({ ...stretch, percent: 0 })),
    ),
  };
}

/**
 * What a Mars lab added to a Research Grant, given the days each earner worked, which is left out if it raised none
 * of them.
 */
function grantBenefitPart(
  worked: Stretch[][],
  grantRaised: Stretch[],
  millions: number,
  unraisedMillions: number,
): Pick<ResearchGrantPaid, "benefit"> {
  const raisedParts = worked.map((stretches) =>
    stretches
      .flatMap(({ fromDay, toDay }) =>
        splitByRaise(fromDay, toDay, grantRaised),
      )
      .filter(({ percent }) => percent > 0),
  );
  const days = Math.max(
    0,
    ...raisedParts.map((parts) =>
      sum(parts.map(({ fromDay, toDay }) => toDay - fromDay)),
    ),
  );
  if (days === 0) return {};
  return {
    benefit: {
      givenBy: [
        ...new Set(raisedParts.flat().flatMap(({ givenBy }) => givenBy)),
      ],
      days,
      millions: millions - unraisedMillions,
    },
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
 * days there less any spent sheltering, rounded up for each of them. At a Landing Site, a Benefit that raises research
 * on the surface raises theirs on the days it covers, as it does an Asset's there, and a Mars lab among `labs` there
 * raises their Research Grants.
 */
export function crewResearch(
  catalogue: Catalogue,
  rules: Rules,
  { name, place, activityId, stays }: CrewAtWork,
  raised: Stretch[],
  labs: AssetInService[] = [],
) {
  const activity = rules.activityById(activityId);
  const turnDays = catalogue.program.launchWindowIntervalDays;
  const grantRaised = grantRaisedStretches(
    catalogue,
    labs,
    place.kind === "landingSite" ? place.landingSiteId : null,
    "crew",
  );
  const each = stays.flatMap((stay) => {
    const stretches = daysWorking({
      ...stay,
      untilDay: stay.untilDay ?? turnDays,
    }).flatMap(({ from, to }) =>
      splitByRaise(from, to, place.kind === "landingSite" ? raised : []),
    );
    if (stretches.length === 0) return [];
    const usual = stretches.map((stretch) => ({ ...stretch, percent: 0 }));
    return [
      {
        stretches,
        earned: earningsFor(catalogue, activity, stretches, grantRaised),
        unraised: earningsFor(catalogue, activity, stretches),
        usual: earningsFor(catalogue, activity, usual),
      },
    ];
  });
  const daysOf = (stretches: Stretch[]) =>
    sum(stretches.map(({ fromDay, toDay }) => toDay - fromDay));
  const days = Math.max(0, ...each.map(({ stretches }) => daysOf(stretches)));
  if (activity?.effect.kind !== "research" || days <= 0) return [];
  const total = (
    part: keyof Earnings,
    which: "earned" | "unraised" | "usual" = "earned",
  ) => sum(each.map((member) => member[which][part]));
  const raisedDays = each.map(({ stretches }) =>
    stretches.filter(({ percent }) => percent > 0),
  );
  const research: OngoingResearchEarned = {
    assetName: name,
    activityName: activity.name,
    science: total("science"),
    publicSupport: total("publicSupport"),
    days,
    ...(raisedDays.some((member) => member.length > 0)
      ? {
          benefit: {
            givenBy: [
              ...new Set(raisedDays.flat().flatMap(({ givenBy }) => givenBy)),
            ],
            days: Math.max(...raisedDays.map(daysOf)),
            science: total("science") - total("science", "usual"),
            publicSupport:
              total("publicSupport") - total("publicSupport", "usual"),
          },
        }
      : {}),
  };
  const grant: ResearchGrantPaid = {
    name,
    millions: total("grantMillions"),
    ...grantBenefitPart(
      each.map(({ stretches }) => stretches),
      grantRaised,
      total("grantMillions"),
      total("grantMillions", "unraised"),
    ),
  };
  return [
    { research, grant, stretches: each.flatMap(({ stretches }) => stretches) },
  ];
}

/**
 * What each Asset doing research earns this Turn, for its days in service less any it spends sheltering, and the
 * Research Grant that pays. On the surface, it earns at the raised rate on the days a Benefit raises surface research.
 * The Science and Public Support are rounded up for each Asset and Turn, so that a short stint still earns something.
 * The Crew in each place earn it too, at their shared Activity's rate for each of them, raised in the same way at a
 * Landing Site. It uses no roll, so only the seed, the plan and the answers decide it.
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
    const {
      activity,
      stretches,
      grantRaised,
      earned,
      unraisedGrantMillions,
      usual,
    } = earningsOfStay(catalogue, rules, stay, raised, inService);
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
    const grant: ResearchGrantPaid = {
      name: stay.asset.name,
      millions: earned.grantMillions,
      ...grantBenefitPart(
        [stretches],
        grantRaised,
        earned.grantMillions,
        unraisedGrantMillions,
      ),
    };
    return [{ research, grant, stretches }];
  });
  results.push(
    ...crewAtWork.flatMap((crew) =>
      crewResearch(catalogue, rules, crew, raised, inService),
    ),
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
