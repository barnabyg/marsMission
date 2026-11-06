import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/** What Assets do and where they land: Mission Events that need a Landing Site, Landing Sites, Activities and Service Life. */
export function assetProblems({
  activities,
  researchKinds,
  launchVehicles,
  assets,
  landingSites,
  missionEvents,
}: Catalogue): string[] {
  const problems: string[] = [];
  const landingSiteEvents = new Set(
    missionEvents
      .filter((event) => event.failureProbability === "landingSite")
      .map((event) => event.id),
  );
  for (const vehicle of launchVehicles) {
    for (const eventId of vehicle.missionEvents) {
      if (landingSiteEvents.has(eventId)) {
        problems.push(
          `${catalogueFileNames.launchVehicles}: "${vehicle.id}" can't use the Mission Event "${eventId}", which needs a Landing Site`,
        );
      }
    }
  }
  for (const asset of assets) {
    for (const eventId of asset.missionEvents) {
      if (landingSiteEvents.has(eventId) && asset.landsAtSite !== true) {
        problems.push(
          `${catalogueFileNames.assets}: "${asset.id}" uses the Mission Event "${eventId}", which needs a Landing Site, so it must set landsAtSite`,
        );
      }
    }
    if (asset.makes !== undefined && asset.landsAtSite !== true) {
      problems.push(
        `${catalogueFileNames.assets}: "${asset.id}" makes ascent propellant, which is made at a Landing Site, so it must set landsAtSite`,
      );
    }
    if (asset.habitat !== undefined && asset.landsAtSite !== true) {
      problems.push(
        `${catalogueFileNames.assets}: "${asset.id}" is a habitat, which houses Crew at a Landing Site, so it must set landsAtSite`,
      );
    }
    if (
      asset.landingRiskMultiplier !== undefined &&
      asset.landsAtSite !== true
    ) {
      problems.push(
        `${catalogueFileNames.assets}: "${asset.id}" has a landingRiskMultiplier, but doesn't land`,
      );
    }
  }
  if (
    assets.some((asset) => asset.landsAtSite === true) &&
    !landingSites.some((site) => site.knownFromStart)
  ) {
    problems.push(
      `${catalogueFileNames.landingSites}: an Asset in ${catalogueFileNames.assets} sets landsAtSite, so at least one Landing Site must be known from the start`,
    );
  }
  // An old save's Asset does nothing unless it can survey, so there must be an Activity to give it.
  if (!activities.some(({ effect }) => effect.kind === "nothing")) {
    problems.push(
      `${catalogueFileNames.activities}: there must be at least one Activity with a "nothing" effect`,
    );
  }
  for (const { id: activityId, effect } of activities) {
    if (
      effect.kind === "research" &&
      !researchKinds.some(({ id }) => id === effect.researchKind)
    ) {
      problems.push(
        `${catalogueFileNames.activities}: "${activityId}" refers to the kind of research "${effect.researchKind}", which isn't in ${catalogueFileNames.researchKinds}`,
      );
    }
  }
  for (const asset of assets) {
    for (const duplicate of findDuplicates(asset.activities)) {
      problems.push(
        `${catalogueFileNames.assets}: "${asset.id}" lists the Activity "${duplicate}" more than once`,
      );
    }
    for (const activityId of asset.activities) {
      const activity = activities.find(({ id }) => id === activityId);
      if (!activity) {
        problems.push(
          `${catalogueFileNames.assets}: "${asset.id}" refers to the Activity "${activityId}", which isn't in ${catalogueFileNames.activities}`,
        );
      } else if (
        asset.landsAtSite === true &&
        activity.effect.kind === "survey"
      ) {
        problems.push(
          `${catalogueFileNames.assets}: "${asset.id}" can't both land and survey, because a Survey is made from orbit`,
        );
      }
    }
  }
  for (const asset of assets) {
    asset.serviceLifeOptions.forEach((option, index) => {
      const shorter = asset.serviceLifeOptions[index - 1];
      if (!shorter) return;
      if (option.days <= shorter.days) {
        problems.push(
          `${catalogueFileNames.assets}: "${asset.id}" has a Service Life of ${option.days} days after one of ${shorter.days}. They go in ascending order`,
        );
      }
      if (option.costMillions < shorter.costMillions) {
        problems.push(
          `${catalogueFileNames.assets}: "${asset.id}" has a Service Life of ${option.days} days that costs less than a shorter one`,
        );
      }
    });
  }
  for (const site of landingSites) {
    if (site.surveyedLandingRisk > site.landingRisk) {
      problems.push(
        `${catalogueFileNames.landingSites}: "${site.id}" has a surveyedLandingRisk higher than its landingRisk`,
      );
    }
  }
  return problems;
}
