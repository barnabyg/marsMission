import type { z } from "zod";
import { catalogueFileNames, schemas, type Catalogue } from "./schemas";

export { catalogueFileNames, isoDate, type Catalogue } from "./schemas";

export type CatalogueFiles = Catalogue;

/** Thrown when the data files are invalid. The message says which file and field to fix. */
export class CatalogueError extends Error {
  override name = "CatalogueError";
}

function parsePart<T>(
  file: string,
  schema: z.ZodType<T>,
  raw: unknown,
  problems: string[],
): T | undefined {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    problems.push(`${file}: ${path === "" ? "" : `${path}: `}${issue.message}`);
  }
  return undefined;
}

function findDuplicates(ids: string[]): string[] {
  return ids.filter((value, index) => ids.indexOf(value) !== index);
}

function crossCheck(catalogue: Catalogue): string[] {
  const problems: string[] = [];
  const {
    program,
    activities,
    researchKinds,
    launchVehicles,
    assets,
    landingSites,
    missionEvents,
    milestones,
    fundingThresholds,
    reliabilityLevels,
    riskBands,
  } = catalogue;

  const parts = [
    [catalogueFileNames.activities, activities],
    [catalogueFileNames.researchKinds, researchKinds],
    [catalogueFileNames.launchVehicles, launchVehicles],
    [catalogueFileNames.assets, assets],
    [catalogueFileNames.landingSites, landingSites],
    [catalogueFileNames.missionEvents, missionEvents],
    [catalogueFileNames.milestones, milestones],
    [catalogueFileNames.reliabilityLevels, reliabilityLevels],
  ] as const;
  for (const [file, items] of parts) {
    for (const duplicate of findDuplicates(items.map((item) => item.id))) {
      problems.push(`${file}: the id "${duplicate}" is used more than once`);
    }
  }

  const eventIds = new Set(missionEvents.map((event) => event.id));
  const eventUsers = [
    [catalogueFileNames.launchVehicles, launchVehicles],
    [catalogueFileNames.assets, assets],
  ] as const;
  for (const [file, items] of eventUsers) {
    for (const item of items) {
      for (const eventId of item.missionEvents) {
        if (!eventIds.has(eventId)) {
          problems.push(
            `${file}: "${item.id}" refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
          );
        }
      }
    }
  }

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
    if ("totalScience" in milestone.trigger) continue;
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

  reliabilityLevels.forEach((level, index) => {
    const lower = reliabilityLevels[index - 1];
    if (!lower) return;
    if (level.costMillions < lower.costMillions) {
      problems.push(
        `${catalogueFileNames.reliabilityLevels}: "${level.id}" costs less than "${lower.id}", the level below it`,
      );
    }
    if (level.failureMultiplier > lower.failureMultiplier) {
      problems.push(
        `${catalogueFileNames.reliabilityLevels}: "${level.id}" has a higher failure probability than "${lower.id}", the level below it`,
      );
    }
  });

  riskBands.forEach(({ upTo }, index) => {
    const previous = riskBands[index - 1]?.upTo ?? 0;
    if (upTo <= previous) {
      problems.push(
        `${catalogueFileNames.riskBands}: ${upTo} must be higher than ${previous}. Bands go in ascending order`,
      );
    }
  });
  if (riskBands.at(-1)?.upTo !== 1) {
    problems.push(
      `${catalogueFileNames.riskBands}: the last band must go up to 1, so that every failure probability has a band`,
    );
  }

  if (program.transferDays >= program.launchWindowIntervalDays) {
    problems.push(
      `${catalogueFileNames.program}: transferDays must be shorter than launchWindowIntervalDays, so that a Mission arrives within its Turn`,
    );
  }

  return problems;
}

/** Validates the raw contents of the data files and returns the catalogue, or throws a CatalogueError. */
export function parseCatalogue(files: CatalogueFiles): Catalogue {
  const problems: string[] = [];
  const program = parsePart(
    catalogueFileNames.program,
    schemas.program,
    files.program,
    problems,
  );
  const activities = parsePart(
    catalogueFileNames.activities,
    schemas.activities,
    files.activities,
    problems,
  );
  const researchKinds = parsePart(
    catalogueFileNames.researchKinds,
    schemas.researchKinds,
    files.researchKinds,
    problems,
  );
  const launchVehicles = parsePart(
    catalogueFileNames.launchVehicles,
    schemas.launchVehicles,
    files.launchVehicles,
    problems,
  );
  const assets = parsePart(
    catalogueFileNames.assets,
    schemas.assets,
    files.assets,
    problems,
  );
  const landingSites = parsePart(
    catalogueFileNames.landingSites,
    schemas.landingSites,
    files.landingSites,
    problems,
  );
  const missionEvents = parsePart(
    catalogueFileNames.missionEvents,
    schemas.missionEvents,
    files.missionEvents,
    problems,
  );

  const milestones = parsePart(
    catalogueFileNames.milestones,
    schemas.milestones,
    files.milestones,
    problems,
  );

  const fundingThresholds = parsePart(
    catalogueFileNames.fundingThresholds,
    schemas.fundingThresholds,
    files.fundingThresholds,
    problems,
  );

  const reliabilityLevels = parsePart(
    catalogueFileNames.reliabilityLevels,
    schemas.reliabilityLevels,
    files.reliabilityLevels,
    problems,
  );

  const riskBands = parsePart(
    catalogueFileNames.riskBands,
    schemas.riskBands,
    files.riskBands,
    problems,
  );

  if (
    !program ||
    !activities ||
    !researchKinds ||
    !launchVehicles ||
    !assets ||
    !landingSites ||
    !missionEvents ||
    !milestones ||
    !fundingThresholds ||
    !reliabilityLevels ||
    !riskBands
  ) {
    throw new CatalogueError(problems.join("\n"));
  }

  const catalogue = {
    program,
    activities,
    researchKinds,
    launchVehicles,
    assets,
    landingSites,
    missionEvents,
    milestones,
    fundingThresholds,
    reliabilityLevels,
    riskBands,
  };
  const crossCheckProblems = crossCheck(catalogue);
  if (crossCheckProblems.length > 0) {
    throw new CatalogueError(crossCheckProblems.join("\n"));
  }
  return catalogue;
}
