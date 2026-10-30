import { z } from "zod";
import { isoDate } from "../catalogue/catalogue";
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

/** Released saves are a compatibility contract: to change this shape, add a new version and keep reading this one. */
const saveFormatVersion = 1;

const count = z.number().int().nonnegative();

const savedProgramSchema = z.strictObject({
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
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("active") }),
    z.strictObject({ kind: z.literal("retired") }),
    z.strictObject({ kind: z.literal("cancelled"), reason: z.string() }),
  ]),
});

export const corruptSave = "This save is corrupt, so it can't be loaded.";

export function saveProgram(program: Program): SavedProgram {
  return { formatVersion: saveFormatVersion, program };
}

export function restoreProgram(saved: unknown): Program {
  // Only the version is checked first, because another format may have any other shape.
  const version = z.looseObject({ formatVersion: z.number() }).safeParse(saved);
  if (!version.success) throw new SaveError(corruptSave);
  const { formatVersion } = version.data;
  if (formatVersion !== saveFormatVersion) {
    throw new SaveError(
      `This save is in format ${formatVersion}, which this version of the game can't read.`,
    );
  }
  const restored = savedProgramSchema.safeParse(version.data.program);
  if (!restored.success) throw new SaveError(corruptSave);
  if (restored.data.status.kind !== "active") {
    throw new SaveError("This Program has ended, so it can't be continued.");
  }
  return restored.data;
}
