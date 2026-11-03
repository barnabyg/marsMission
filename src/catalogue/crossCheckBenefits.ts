import { catalogueFileNames, type Catalogue } from "./schemas";

/** Benefits between Assets: that each has something to raise. */
export function benefitProblems({ activities, assets }: Catalogue): string[] {
  const research = new Set(
    activities
      .filter(({ effect }) => effect.kind === "research")
      .map(({ id }) => id),
  );
  const surfaceResearch = assets.some(
    (asset) =>
      asset.landsAtSite === true &&
      asset.activities.some((activityId) => research.has(activityId)),
  );
  return assets.flatMap(({ id, benefit }) =>
    benefit?.raises === "surfaceResearch" && !surfaceResearch
      ? [
          `${catalogueFileNames.assets}: "${id}" raises surface research, which no Asset that lands has an Activity to earn`,
        ]
      : [],
  );
}
