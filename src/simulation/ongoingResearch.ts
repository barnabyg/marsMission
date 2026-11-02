import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { sum, type Activity, type Rules } from "./rules";
import type {
  OngoingResearchEarned,
  PlannedActivity,
  TurnSummary,
} from "./types";

/** The Research Grant for this Science, in whole millions, which can round to nothing. */
function researchGrantFor(
  catalogue: Catalogue,
  researchKind: string,
  science: number,
): number {
  const kind = catalogue.researchKinds.find(({ id }) => id === researchKind);
  return Math.round(science * (kind?.grantMillionsPerScience ?? 0));
}

/** What an Activity earns over a whole Turn in service, if it's research. */
export function earningsPerTurn(
  catalogue: Catalogue,
  { effect }: Activity,
): PlannedActivity["earnsPerTurn"] {
  return effect.kind === "research"
    ? {
        science: effect.sciencePerTurn,
        publicSupport: effect.publicSupportPerTurn,
        researchGrantMillions: researchGrantFor(
          catalogue,
          effect.researchKind,
          effect.sciencePerTurn,
        ),
      }
    : null;
}

/** What an Activity earns for this many days of a Turn, which is nothing if it isn't research. */
export function earningsForDays(
  catalogue: Catalogue,
  activity: Activity | undefined,
  days: number,
): { science: number; publicSupport: number; grantMillions: number } {
  if (activity?.effect.kind !== "research" || days <= 0) {
    return { science: 0, publicSupport: 0, grantMillions: 0 };
  }
  const { sciencePerTurn, publicSupportPerTurn, researchKind } =
    activity.effect;
  const forDays = (perTurn: number) =>
    Math.ceil((perTurn * days) / catalogue.program.launchWindowIntervalDays);
  const science = forDays(sciencePerTurn);
  return {
    science,
    publicSupport: forDays(publicSupportPerTurn),
    grantMillions: researchGrantFor(catalogue, researchKind, science),
  };
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
 * What each Asset doing research earns this Turn, for its days in service less any it spends sheltering, and the
 * Research Grant that pays. The Science and Public Support are rounded up for each Asset and Turn, so that a short
 * stint still earns something. It uses no roll, so only the seed, the plan and the answers decide it.
 */
export function carryOutOngoingResearch(
  catalogue: Catalogue,
  rules: Rules,
  inService: AssetInService[],
): {
  earned: OngoingResearchEarned[];
  science: number;
  publicSupport: number;
  researchGrants: TurnSummary["researchGrants"];
  researchGrantMillions: number;
  /** When each Asset earned what it did, which builds up evenly over its days. */
  stints: {
    fromDay: number;
    toDay: number;
    science: number;
    publicSupport: number;
  }[];
} {
  const { launchWindowIntervalDays } = catalogue.program;
  const results = inService.flatMap((stay) => {
    const { asset, untilDay } = stay;
    const activity = rules.activityById(asset.activityId);
    const working = daysWorking({
      ...stay,
      untilDay: untilDay ?? launchWindowIntervalDays,
    });
    const days = sum(working.map(({ from, to }) => to - from));
    if (activity?.effect.kind !== "research" || days <= 0) return [];
    const { science, publicSupport, grantMillions } = earningsForDays(
      catalogue,
      activity,
      days,
    );
    const earned: OngoingResearchEarned = {
      assetName: asset.name,
      activityName: activity.name,
      science,
      publicSupport,
      days,
    };
    const grant = { name: asset.name, millions: grantMillions };
    return [{ earned, grant, working }];
  });
  const earned = results.map((result) => result.earned);
  const researchGrants = results
    .map(({ grant }) => grant)
    .filter(({ millions }) => millions > 0);
  return {
    earned,
    science: sum(earned.map(({ science }) => science)),
    publicSupport: sum(earned.map(({ publicSupport }) => publicSupport)),
    researchGrants,
    researchGrantMillions: sum(researchGrants.map(({ millions }) => millions)),
    stints: results.flatMap(({ earned, working }) =>
      working.map(({ from, to }) => ({
        fromDay: from,
        toDay: to,
        science: (earned.science * (to - from)) / earned.days,
        publicSupport: (earned.publicSupport * (to - from)) / earned.days,
      })),
    ),
  };
}
