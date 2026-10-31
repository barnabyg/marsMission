import { z } from "zod";
import { isoDate, type Catalogue } from "../catalogue/catalogue";
import type { Program } from "./types";

/** A Program as data, for keeping between sessions. */
export interface SavedProgram {
  formatVersion: number;
  program: Program;
}

/** Thrown when a save can't be restored. The message is written for the player. */
export class SaveError extends Error {
  override name = "SaveError";
}

export const corruptSave = "This save is corrupt, so it can't be loaded.";

/**
 * One released save format. Released saves are a compatibility contract: to change the saved shape,
 * add a new format to the end of `formats`, and give the one before it an `upgrade` to the new shape.
 */
export interface SaveFormat {
  schema: z.ZodType;
  /** Turns a Program in this format into the next format. Only the newest format has none. */
  upgrade?: (program: never, catalogue: Catalogue) => unknown;
}

const count = z.number().int().nonnegative();

const programStatus = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("active") }),
  z.strictObject({ kind: z.literal("retired") }),
  z.strictObject({ kind: z.literal("cancelled"), reason: z.string() }),
]);

const format1 = z.strictObject({
  seed: z.number().int(),
  turnNumber: z.number().int().positive(),
  date: isoDate,
  moneyMillions: count,
  publicSupport: count,
  science: count,
  milestoneIds: z.array(z.string()),
  fundingThresholdsPaid: z.array(count),
  operatingAssets: z.array(
    z.strictObject({
      assetId: z.string(),
      name: z.string(),
      kind: z.string(),
      arrivedOn: isoDate,
    }),
  ),
  status: programStatus,
});

/** Adds the sites landed at and where each Asset is. Everything saved before this was in orbit. */
const format2 = format1.extend({
  landedSiteIds: z.array(z.string()),
  operatingAssets: z.array(
    z.strictObject({
      ...format1.shape.operatingAssets.element.shape,
      landingSiteId: z.string().nullable(),
    }),
  ),
});

/** Adds Survey progress. A save from before Surveys has only the sites known from the start, none of them surveyed. */
const format3 = format2.extend({
  knownLandingSiteIds: z.array(z.string()),
  surveyedLandingSiteIds: z.array(z.string()),
});

/** Adds each Asset's Service Life. A save from before Service Life gets the shortest option for its kind, counted from its arrival. */
const format4 = format3.extend({
  operatingAssets: z.array(
    z.strictObject({
      ...format2.shape.operatingAssets.element.shape,
      serviceLifeDays: z.number().int().positive(),
    }),
  ),
});

function shortestServiceLife(
  { assetId, kind }: { assetId: string; kind: string },
  { assets }: Catalogue,
): number {
  const asset =
    assets.find(({ id }) => id === assetId) ??
    assets.find((candidate) => candidate.kind === kind);
  const shortest = asset?.serviceLifeOptions[0];
  if (!shortest) throw new SaveError(corruptSave);
  return shortest.days;
}

/** Adds each Asset's Reliability. A save from before it gets the cheapest level. */
const format5 = format4.extend({
  operatingAssets: z.array(
    z.strictObject({
      ...format4.shape.operatingAssets.element.shape,
      reliabilityLevelId: z.string(),
    }),
  ),
});

const newestFormat = format5;

/** Every format so far, oldest first. A format's version is its position in this list, counting from 1. */
const formats: readonly SaveFormat[] = [
  {
    schema: format1,
    upgrade: (old: z.output<typeof format1>): z.output<typeof format2> => ({
      ...old,
      landedSiteIds: [],
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        landingSiteId: null,
      })),
    }),
  },
  {
    schema: format2,
    upgrade: (
      old: z.output<typeof format2>,
      { landingSites }: Catalogue,
    ): z.output<typeof format3> => ({
      ...old,
      knownLandingSiteIds: landingSites
        .filter((site) => site.knownFromStart)
        .map((site) => site.id),
      surveyedLandingSiteIds: [],
    }),
  },
  {
    schema: format3,
    upgrade: (
      old: z.output<typeof format3>,
      catalogue: Catalogue,
    ): z.output<typeof format4> => ({
      ...old,
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        serviceLifeDays: shortestServiceLife(asset, catalogue),
      })),
    }),
  },
  {
    schema: format4,
    upgrade: (
      old: z.output<typeof format4>,
      { reliabilityLevels }: Catalogue,
    ): z.output<typeof format5> => {
      const cheapest = reliabilityLevels[0];
      if (!cheapest) throw new SaveError(corruptSave);
      return {
        ...old,
        operatingAssets: old.operatingAssets.map((asset) => ({
          ...asset,
          reliabilityLevelId: cheapest.id,
        })),
      };
    },
  },
  { schema: newestFormat },
];

export function saveProgram(program: Program): SavedProgram {
  return { formatVersion: formats.length, program };
}

/** The Program in a save, upgraded through each format after the one it was saved in. */
export function restoreThroughFormats(
  saved: unknown,
  catalogue: Catalogue,
  saveFormats: readonly SaveFormat[],
): unknown {
  // Only the version is checked first, because another format may have any other shape.
  const version = z.looseObject({ formatVersion: z.number() }).safeParse(saved);
  if (!version.success) throw new SaveError(corruptSave);
  const { formatVersion } = version.data;
  if (
    !Number.isInteger(formatVersion) ||
    formatVersion < 1 ||
    formatVersion > saveFormats.length
  ) {
    throw new SaveError(
      `This save is in format ${formatVersion}, which this version of the game can't read.`,
    );
  }
  let program: unknown = version.data.program;
  for (const { schema, upgrade } of saveFormats.slice(formatVersion - 1)) {
    const parsed = schema.safeParse(program);
    if (!parsed.success) throw new SaveError(corruptSave);
    program = upgrade ? upgrade(parsed.data as never, catalogue) : parsed.data;
  }
  return program;
}

export function restoreProgram(saved: unknown, catalogue: Catalogue): Program {
  const restored = newestFormat.safeParse(
    restoreThroughFormats(saved, catalogue, formats),
  );
  if (!restored.success) throw new SaveError(corruptSave);
  const program: Program = restored.data;
  if (program.status.kind !== "active") {
    throw new SaveError("This Program has ended, so it can't be continued.");
  }
  return program;
}
