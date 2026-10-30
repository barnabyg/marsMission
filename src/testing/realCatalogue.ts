import { readFileSync } from "node:fs";
import {
  catalogueFileNames,
  type CatalogueFiles,
} from "../catalogue/catalogue";

/** The contents of the real data files, for tests that check the game's actual balance. */
export function realCatalogueFiles(): CatalogueFiles {
  return Object.fromEntries(
    Object.entries(catalogueFileNames).map(([key, fileName]) => [
      key,
      JSON.parse(readFileSync(`public/data/${fileName}`, "utf8")) as unknown,
    ]),
  ) as unknown as CatalogueFiles;
}
