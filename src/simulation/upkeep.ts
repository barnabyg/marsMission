import type { Catalogue } from "../catalogue/catalogue";
import { daysUntilServiceEnds, operatingKey, sum } from "./rules";
import type { Program, TurnPlan } from "./types";

/**
 * Upkeep: what each Asset operating at Mars costs for every Turn it is kept going, and ending an Asset's mission, which
 * takes it out of service as the Turn starts so that it costs nothing more.
 */

/** What this operating Asset costs to keep going for a Turn, which is nothing once its Service Life has ended. */
export function upkeepOf(
  catalogue: Catalogue,
  program: Program,
  asset: Program["operatingAssets"][number],
): number {
  if (daysUntilServiceEnds(program.date, asset) <= 0) return 0;
  return (
    catalogue.assets.find(({ id }) => id === asset.assetId)
      ?.upkeepMillionsPerTurn ?? 0
  );
}

/** The Program as the Turn starts, without the Assets whose missions the plan ends. */
export function withMissionsEnded(program: Program, plan: TurnPlan): Program {
  const ended = plan.endedAssetKeys ?? [];
  if (ended.length === 0) return program;
  return {
    ...program,
    operatingAssets: program.operatingAssets.filter(
      (asset) => !ended.includes(operatingKey(asset)),
    ),
  };
}

/** What keeping every Asset the plan doesn't end costs this Turn. */
export function upkeepFor(
  catalogue: Catalogue,
  program: Program,
  plan: TurnPlan,
): number {
  const kept = withMissionsEnded(program, plan);
  return sum(
    kept.operatingAssets.map((asset) => upkeepOf(catalogue, program, asset)),
  );
}

/** What's wrong with the Assets a plan ends, if anything. */
export function endedAssetProblems(program: Program, plan: TurnPlan): string[] {
  const ended = plan.endedAssetKeys ?? [];
  const problems = ended
    .filter(
      (key) =>
        !program.operatingAssets.some((asset) => operatingKey(asset) === key),
    )
    .map((key) => `There is no operating Asset called "${key}".`);
  if (new Set(ended).size < ended.length) {
    problems.push("A plan can't end the same Asset's mission twice.");
  }
  return problems;
}
