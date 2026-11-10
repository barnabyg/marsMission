import { z } from "zod";
import type { Catalogue } from "../catalogue/catalogue";

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
