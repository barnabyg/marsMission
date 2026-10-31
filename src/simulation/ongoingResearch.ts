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

/**
 * What each Asset doing research earns this Turn, for its days in service, and the Research Grant that pays. The
 * Science and Public Support are rounded up for each Asset and Turn, so that a short stint still earns something. It
 * uses no roll, so only the seed and the plan decide it.
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
  const results = inService.flatMap(({ asset, fromDay, untilDay }) => {
    const activity = rules.activityById(asset.activityId);
    const days = (untilDay ?? launchWindowIntervalDays) - fromDay;
    if (activity?.effect.kind !== "research" || days <= 0) return [];
    const { sciencePerTurn, publicSupportPerTurn, researchKind } =
      activity.effect;
    const forDays = (perTurn: number) =>
      Math.ceil((perTurn * days) / launchWindowIntervalDays);
    const science = forDays(sciencePerTurn);
    const earned: OngoingResearchEarned = {
      assetName: asset.name,
      activityName: activity.name,
      science,
      publicSupport: forDays(publicSupportPerTurn),
      days,
    };
    const grant = {
      name: asset.name,
      millions: researchGrantFor(catalogue, researchKind, science),
    };
    return [{ earned, grant, fromDay }];
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
    stints: results.map(({ earned, fromDay }) => ({
      fromDay,
      toDay: fromDay + earned.days,
      science: earned.science,
      publicSupport: earned.publicSupport,
    })),
  };
}
