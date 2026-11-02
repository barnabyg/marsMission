import { catalogueFileNames, type Catalogue } from "./schemas";

/**
 * Technology Readiness: what a technology costs and risks until it is Flight-proven, given only for one that doesn't
 * start that way, its Development, given only for one that isn't built yet, and ids that name one technology each, because the Program saves which are Flight-proven by id.
 */
export function technologyProblems({
  assets,
  launchVehicles,
}: Catalogue): string[] {
  const problems: string[] = [];
  const parts = [
    [catalogueFileNames.assets, assets],
    [catalogueFileNames.launchVehicles, launchVehicles],
  ] as const;
  for (const [file, technologies] of parts) {
    for (const {
      id,
      costMillions,
      technologyReadiness,
      unproven,
      development,
    } of [...technologies]) {
      if (technologyReadiness === "not-built") {
        if (!development) {
          problems.push(
            `${file}: "${id}" isn't built yet, so it must have "development", with what its Development costs and how many Turns it takes`,
          );
        }
      } else if (development) {
        problems.push(
          `${file}: "${id}" is already built, so it can't have "development"`,
        );
      }
      if (technologyReadiness === "flight-proven") {
        if (unproven) {
          problems.push(
            `${file}: "${id}" starts Flight-proven, so it can't have an unproven cost and failureMultiplier`,
          );
        }
      } else if (!unproven) {
        problems.push(
          `${file}: "${id}" isn't Flight-proven, so it must have "unproven", with what it costs and how much more often it fails until it is`,
        );
      } else if (unproven.costMillions < costMillions) {
        problems.push(
          `${file}: "${id}" costs less unproven than Flight-proven`,
        );
      }
    }
  }
  const assetIds = new Set(assets.map(({ id }) => id));
  for (const { id } of launchVehicles) {
    if (assetIds.has(id)) {
      problems.push(
        `${catalogueFileNames.launchVehicles}: the id "${id}" is used by both an Asset and a Launch Vehicle, which must differ because the Program saves which are Flight-proven by id`,
      );
    }
  }
  return problems;
}
