import {
  catalogueFileNames,
  CatalogueError,
  parseCatalogue,
  type Catalogue,
  type CatalogueFiles,
} from "../catalogue/catalogue";

async function fetchDataFile(fileName: string): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${fileName}`);
  if (!response.ok) {
    throw new CatalogueError(
      `${fileName}: couldn't be loaded (HTTP ${response.status})`,
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new CatalogueError(
      `${fileName}: isn't valid JSON (${String(error)})`,
    );
  }
}

/** Loads and validates the data files, throwing a CatalogueError if they are invalid. */
export async function fetchCatalogue(): Promise<Catalogue> {
  const entries = await Promise.all(
    Object.entries(catalogueFileNames).map(
      async ([key, fileName]) => [key, await fetchDataFile(fileName)] as const,
    ),
  );
  return parseCatalogue(
    Object.fromEntries(entries) as unknown as CatalogueFiles,
  );
}
