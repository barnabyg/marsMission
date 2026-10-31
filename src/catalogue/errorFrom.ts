import {
  CatalogueError,
  parseCatalogue,
  type CatalogueFiles,
} from "./catalogue";

/** The message from rejecting these data files, for tests of what the Catalogue rejects. */
export function errorFrom(files: unknown): string {
  try {
    parseCatalogue(files as CatalogueFiles);
  } catch (error) {
    if (error instanceof CatalogueError) return error.message;
    throw error;
  }
  throw new Error("Expected the catalogue to be rejected");
}
