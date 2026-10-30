import { z } from "zod";

const id = z.string().min(1);
const money = z.number().int().nonnegative();

const isoDate = z.string().refine((value) => {
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
  }),
);

const missionEventsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    timing: z.strictObject({
      from: z.enum(["launch", "arrival"]),
      days: z.number().int().nonnegative(),
    }),
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

const schemas = {
  program: programSchema,
  launchVehicles: launchVehiclesSchema,
  assets: assetsSchema,
  missionEvents: missionEventsSchema,
  milestones: milestonesSchema,
};

/** The data file behind each part of the catalogue, relative to the data folder. */
export const catalogueFileNames = {
  program: "program.json",
  launchVehicles: "launch-vehicles.json",
  assets: "assets.json",
  missionEvents: "mission-events.json",
  milestones: "milestones.json",
} as const satisfies Record<keyof typeof schemas, string>;

export interface Catalogue {
  program: z.output<typeof programSchema>;
  launchVehicles: z.output<typeof launchVehiclesSchema>;
  assets: z.output<typeof assetsSchema>;
  missionEvents: z.output<typeof missionEventsSchema>;
  milestones: z.output<typeof milestonesSchema>;
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
  const { program, launchVehicles, assets, missionEvents, milestones } =
    catalogue;

  const parts = [
    [catalogueFileNames.launchVehicles, launchVehicles],
    [catalogueFileNames.assets, assets],
    [catalogueFileNames.missionEvents, missionEvents],
    [catalogueFileNames.milestones, milestones],
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

  const assetKinds = new Set(assets.map((asset) => asset.kind));
  for (const milestone of milestones) {
    const kind = milestone.trigger.assetKindArrives;
    if (!assetKinds.has(kind)) {
      problems.push(
        `${catalogueFileNames.milestones}: "${milestone.id}" needs an Asset of kind "${kind}", but ${catalogueFileNames.assets} has none`,
      );
    }
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

  if (!program || !launchVehicles || !assets || !missionEvents || !milestones) {
    throw new CatalogueError(problems.join("\n"));
  }

  const catalogue = {
    program,
    launchVehicles,
    assets,
    missionEvents,
    milestones,
  };
  const crossCheckProblems = crossCheck(catalogue);
  if (crossCheckProblems.length > 0) {
    throw new CatalogueError(crossCheckProblems.join("\n"));
  }
  return catalogue;
}
