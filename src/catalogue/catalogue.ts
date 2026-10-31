import { z } from "zod";

const id = z.string().min(1);
const money = z.number().int().nonnegative();

export const isoDate = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(value)
  );
}, "must be a real date written as YYYY-MM-DD");

const programSchema = z.strictObject({
  firstLaunchWindow: isoDate,
  launchWindowIntervalDays: z.number().int().positive(),
  startingMoneyMillions: money,
  startingPublicSupport: z.number().int().nonnegative(),
  transferDays: z.number().int().positive(),
  // At least 1%, and a level of at least 1, so a Program that only skips Turns is always cancelled.
  publicSupportDrainPercent: z.number().int().min(1).max(100),
  cancellationLevel: z.number().int().min(1),
});

const launchVehiclesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    costMillions: money,
    missionEvents: z.array(id),
  }),
);

const assetsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    kind: id,
    costMillions: money,
    missionEvents: z.array(id),
    // Whether this Asset is a lander, so that a Mission carrying it must name a Landing Site.
    landsAtSite: z.boolean().optional(),
  }),
);

const landingSitesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    landingRisk: z.number().min(0).max(1),
    surveyedLandingRisk: z.number().min(0).max(1),
    // Earned by the first successful landing at this site.
    science: z.number().int().nonnegative(),
    knownFromStart: z.boolean(),
  }),
);

const missionEventsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    // {site} in either description stands for the Mission's Landing Site.
    description: z.string().min(1),
    failureDescription: z.string().min(1),
    timing: z.strictObject({
      from: z.enum(["launch", "arrival"]),
      days: z.number().int().nonnegative(),
    }),
    // "landingSite" means the risk of the Mission's Landing Site.
    failureProbability: z.union([
      z.number().min(0).max(1),
      z.literal("landingSite"),
    ]),
    publicSupportLoss: z.number().int().nonnegative(),
  }),
);

const milestonesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    trigger: z.strictObject({ assetKindArrives: id }),
    science: z.number().int().nonnegative(),
    publicSupport: z.number().int().nonnegative(),
  }),
);

const fundingThresholdsSchema = z.array(
  z.strictObject({
    publicSupport: z.number().int().positive(),
    payoutMillions: z.number().int().positive(),
  }),
);

const reliabilityLevelsSchema = z
  .array(
    z.strictObject({
      id,
      name: z.string().min(1),
      costMillions: money,
      // What a Mission Event's failure probability is multiplied by at this level.
      failureMultiplier: z.number().min(0).max(1),
    }),
  )
  .min(1);

const riskBandsSchema = z
  .array(
    z.strictObject({
      upTo: z.number().positive().max(1),
      label: z.string().min(1),
    }),
  )
  .min(1);

const schemas = {
  program: programSchema,
  launchVehicles: launchVehiclesSchema,
  assets: assetsSchema,
  landingSites: landingSitesSchema,
  missionEvents: missionEventsSchema,
  milestones: milestonesSchema,
  fundingThresholds: fundingThresholdsSchema,
  reliabilityLevels: reliabilityLevelsSchema,
  riskBands: riskBandsSchema,
};

/** The data file behind each part of the catalogue, relative to the data folder. */
export const catalogueFileNames = {
  program: "program.json",
  launchVehicles: "launch-vehicles.json",
  assets: "assets.json",
  landingSites: "landing-sites.json",
  missionEvents: "mission-events.json",
  milestones: "milestones.json",
  fundingThresholds: "funding-thresholds.json",
  reliabilityLevels: "reliability-levels.json",
  riskBands: "risk-bands.json",
} as const satisfies Record<keyof typeof schemas, string>;

export interface Catalogue {
  program: z.output<typeof programSchema>;
  launchVehicles: z.output<typeof launchVehiclesSchema>;
  assets: z.output<typeof assetsSchema>;
  /** In the order a Survey reveals them. */
  landingSites: z.output<typeof landingSitesSchema>;
  missionEvents: z.output<typeof missionEventsSchema>;
  milestones: z.output<typeof milestonesSchema>;
  fundingThresholds: z.output<typeof fundingThresholdsSchema>;
  /** In order, cheapest first. */
  reliabilityLevels: z.output<typeof reliabilityLevelsSchema>;
  riskBands: z.output<typeof riskBandsSchema>;
}

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
      `${catalogueFileNames.landingSites}: there is a lander in ${catalogueFileNames.assets}, so at least one Landing Site must be known from the start`,
    );
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
