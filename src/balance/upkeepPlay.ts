import type { ProgramView, TurnPlan } from "../simulation/simulation";
import type { PlanningTools } from "./strategy";

/**
 * What every play style does about upkeep, as a careful player would: it keeps every Asset at Mars while it can pay
 * for them, ending the missions of those with the least Service Life left until it can, and any more it is asked to. It then plans with what is
 * left, so the view it plans from has the upkeep taken off its Money and only the Assets it keeps.
 */
export function payUpkeep(
  view: ProgramView,
  /** How many of them to end anyway, least Service Life left first, such as to free the Money for a launch. */
  alsoEnd = 0,
): {
  endedAssetKeys: string[];
  view: ProgramView;
} {
  const byDaysLeft = [...view.operatingAssets]
    .filter(({ upkeepMillions }) => upkeepMillions > 0)
    .sort((first, second) => first.daysLeft - second.daysLeft);
  let upkeepMillions = byDaysLeft.reduce(
    (total, { upkeepMillions: each }) => total + each,
    0,
  );
  const endedAssetKeys: string[] = [];
  for (const asset of byDaysLeft) {
    if (
      upkeepMillions <= view.moneyMillions &&
      endedAssetKeys.length >= alsoEnd
    ) {
      break;
    }
    endedAssetKeys.push(asset.key);
    upkeepMillions -= asset.upkeepMillions;
  }
  return {
    endedAssetKeys,
    view: {
      ...view,
      moneyMillions: view.moneyMillions - upkeepMillions,
      operatingAssets: view.operatingAssets.filter(
        ({ key }) => !endedAssetKeys.includes(key),
      ),
    },
  };
}

/** A plan that also ends these Assets' missions, left as it was if there are none. */
export function ending(plan: TurnPlan, endedAssetKeys: string[]): TurnPlan {
  return endedAssetKeys.length === 0 ? plan : { ...plan, endedAssetKeys };
}

/** The planning tools, checking every plan as one that ends these Assets' missions. */
export function toolsEnding(
  tools: PlanningTools,
  endedAssetKeys: string[],
): PlanningTools {
  return {
    ...tools,
    problemsWith: (plan) => tools.problemsWith(ending(plan, endedAssetKeys)),
    costOf: (plan) => tools.costOf(ending(plan, endedAssetKeys)),
  };
}
