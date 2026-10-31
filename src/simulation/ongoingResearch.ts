import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { sum, type Activity, type Rules } from "./rules";
import type { OngoingResearchEarned, PlannedActivity } from "./types";

/** What an Activity earns over a whole Turn in service, if it's research. */
export function earningsPerTurn({
  effect,
}: Activity): PlannedActivity["earnsPerTurn"] {
  return effect.kind === "research"
    ? {
        science: effect.sciencePerTurn,
        publicSupport: effect.publicSupportPerTurn,
      }
    : null;
}

/**
 * What each Asset doing research earns this Turn, for its days in service. It's rounded up for each Asset and Turn, so
 * that a short stint still earns something. It uses no roll, so only the seed and the plan decide it.
 */
export function carryOutOngoingResearch(
  catalogue: Catalogue,
  rules: Rules,
  inService: AssetInService[],
): { earned: OngoingResearchEarned[]; science: number; publicSupport: number } {
  const { launchWindowIntervalDays } = catalogue.program;
  const earned = inService.flatMap(
    ({ asset, fromDay, untilDay }): OngoingResearchEarned[] => {
      const activity = rules.activityById(asset.activityId);
      const rates = activity && earningsPerTurn(activity);
      const days = (untilDay ?? launchWindowIntervalDays) - fromDay;
      if (!activity || !rates || days <= 0) return [];
      const forDays = (perTurn: number) =>
        Math.ceil((perTurn * days) / launchWindowIntervalDays);
      return [
        {
          assetName: asset.name,
          activityName: activity.name,
          science: forDays(rates.science),
          publicSupport: forDays(rates.publicSupport),
          days,
        },
      ];
    },
  );
  return {
    earned,
    science: sum(earned.map(({ science }) => science)),
    publicSupport: sum(earned.map(({ publicSupport }) => publicSupport)),
  };
}
