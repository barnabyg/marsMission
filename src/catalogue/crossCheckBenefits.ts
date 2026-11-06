import { catalogueFileNames, type Catalogue } from "./schemas";

/**
 * Benefits between Assets: that each has something to raise, and that one raising Research Grants at its Landing Site
 * lands, and raises kinds of Asset that land.
 */
export function benefitProblems({
  activities,
  assets,
  crew,
  researchKinds,
}: Catalogue): string[] {
  const research = new Set(
    activities
      .filter(({ effect }) => effect.kind === "research")
      .map(({ id }) => id),
  );
  const paying = new Set(
    activities.flatMap(({ id, effect }) =>
      effect.kind === "research" &&
      researchKinds.some(
        (kind) =>
          kind.id === effect.researchKind && kind.grantMillionsPerScience > 0,
      )
        ? [id]
        : [],
    ),
  );
  const landing = assets.filter((asset) => asset.landsAtSite === true);
  const surfaceResearch = landing.some((asset) =>
    asset.activities.some((activityId) => research.has(activityId)),
  );
  return assets.flatMap(({ id, benefit, landsAtSite }) => {
    if (benefit?.raises === "surfaceResearch") {
      return surfaceResearch
        ? []
        : [
            `${catalogueFileNames.assets}: "${id}" raises surface research, which no Asset that lands has an Activity to earn`,
          ];
    }
    if (benefit?.raises !== "siteResearchGrants") return [];
    const problems: string[] = [];
    if (landsAtSite !== true) {
      problems.push(
        `${catalogueFileNames.assets}: "${id}" raises Research Grants at its Landing Site, so it must set landsAtSite`,
      );
    }
    for (const kind of benefit.assetKinds) {
      if (!landing.some((asset) => asset.kind === kind)) {
        problems.push(
          `${catalogueFileNames.assets}: "${id}" raises the Research Grants of "${kind}" Assets at its Landing Site, but no Asset of that kind lands`,
        );
      }
    }
    const raisedPays =
      landing.some(
        (asset) =>
          benefit.assetKinds.includes(asset.kind) &&
          asset.activities.some((activityId) => paying.has(activityId)),
      ) ||
      (benefit.crew &&
        crew.surfaceActivities.some((activityId) => paying.has(activityId)));
    if (!raisedPays) {
      problems.push(
        `${catalogueFileNames.assets}: "${id}" raises Research Grants at its Landing Site, but nothing it raises has an Activity that pays one`,
      );
    }
    return problems;
  });
}
