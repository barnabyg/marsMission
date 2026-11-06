import { catalogueFileNames, type Catalogue } from "./schemas";

/** Every Milestone can be earned, and Funding Thresholds rise from the starting Public Support. */
export function milestoneProblems({
  program,
  assets,
  milestones,
  fundingThresholds,
}: Catalogue): string[] {
  const problems: string[] = [];
  const assetKinds = new Set(assets.map((asset) => asset.kind));
  for (const milestone of milestones) {
    if ("assetLands" in milestone.trigger) {
      if (!assets.some((asset) => asset.landsAtSite === true)) {
        problems.push(
          `${catalogueFileNames.milestones}: "${milestone.id}" needs an Asset that lands, but none in ${catalogueFileNames.assets} sets landsAtSite`,
        );
      }
      continue;
    }
    // Every catalogue has a Crewed Mission, which can land or make a round trip, so Crew can always arrive, land and
    // come home.
    if (
      "totalScience" in milestone.trigger ||
      "crewArrives" in milestone.trigger ||
      "crewLands" in milestone.trigger ||
      "crewComesHome" in milestone.trigger ||
      // Checked with the rest of sample return (`crossCheckSamples.ts`).
      "samplesComeHome" in milestone.trigger
    ) {
      continue;
    }
    const kind = milestone.trigger.assetKindArrives;
    if (!assetKinds.has(kind)) {
      problems.push(
        `${catalogueFileNames.milestones}: "${milestone.id}" needs an Asset of kind "${kind}", but ${catalogueFileNames.assets} has none`,
      );
    }
  }

  fundingThresholds.forEach(({ publicSupport }, index) => {
    const previous =
      fundingThresholds[index - 1]?.publicSupport ??
      program.startingPublicSupport;
    if (publicSupport <= previous) {
      problems.push(
        `${catalogueFileNames.fundingThresholds}: ${publicSupport} must be higher than ${previous}. Thresholds go in ascending order, above the starting Public Support`,
      );
    }
  });
  return problems;
}
