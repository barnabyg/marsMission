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

/** Every format so far, oldest first. A format's version is its position in this list, counting from 1. */
const formats: readonly SaveFormat[] = [{ schema: format1 }];

export const corruptSave = "This save is corrupt, so it can't be loaded.";

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
  const program = restoreThroughFormats(saved, catalogue, formats) as Program;
  if (program.status.kind !== "active") {
    throw new SaveError("This Program has ended, so it can't be continued.");
  }
  return program;
}
