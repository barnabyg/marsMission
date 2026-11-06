import { catalogueFileNames, type Catalogue } from "./schemas";

/**
 * Sample return: Sample caching is done at a Landing Site, an ascent vehicle lands there and an Earth return orbiter
 * waits in Mars orbit, and each has the other to meet. The First samples returned Milestone can be earned.
 */
export function sampleProblems({
  activities,
  assets,
  crew,
  milestones,
}: Catalogue): string[] {
  const problems: string[] = [];
  const file = catalogueFileNames.assets;
  const caching = new Set(
    activities
      .filter(({ effect }) => effect.kind === "sampleCaching")
      .map(({ id }) => id),
  );
  for (const asset of assets) {
    const cached = asset.activities.find((id) => caching.has(id));
    if (cached !== undefined && asset.landsAtSite !== true) {
      problems.push(
        `${file}: "${asset.id}" can do the Activity "${cached}", which caches samples at a Landing Site, so it must set landsAtSite`,
      );
    }
    if (asset.sampleReturn === "ascent" && asset.landsAtSite !== true) {
      problems.push(
        `${file}: "${asset.id}" is an ascent vehicle, which lifts samples off a Landing Site, so it must set landsAtSite`,
      );
    }
    if (asset.sampleReturn === "earthReturn" && asset.landsAtSite === true) {
      problems.push(
        `${file}: "${asset.id}" is an Earth return orbiter, which waits in Mars orbit, so it can't set landsAtSite`,
      );
    }
  }
  const ascent = assets.some(({ sampleReturn }) => sampleReturn === "ascent");
  const orbiter = assets.some(
    ({ sampleReturn }) => sampleReturn === "earthReturn",
  );
  if (ascent !== orbiter) {
    problems.push(
      ascent
        ? `${file}: an ascent vehicle needs an Earth return orbiter to meet in Mars orbit, but no Asset sets sampleReturn to "earthReturn"`
        : `${file}: an Earth return orbiter needs an ascent vehicle to bring it samples, but no Asset sets sampleReturn to "ascent"`,
    );
  }
  // Crew who land on a round trip bring samples of their own, and robotic sample return needs samples cached to bring.
  const cachingAsset = assets.some(({ activities: listed }) =>
    listed.some((id) => caching.has(id)),
  );
  const canReturn =
    crew.roundTrip.ascent.samplesPerMember > 0 ||
    (ascent && orbiter && cachingAsset);
  for (const milestone of milestones) {
    if ("samplesComeHome" in milestone.trigger && !canReturn) {
      problems.push(
        `${catalogueFileNames.milestones}: "${milestone.id}" needs samples to come home, but Crew bring none of their own and no Asset caches samples for an ascent vehicle and an Earth return orbiter to bring`,
      );
    }
  }
  return problems;
}
