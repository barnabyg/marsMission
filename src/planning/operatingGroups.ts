/** The Assets at one place at Mars: Mars orbit, or a Landing Site, named as the table's group heading. */
export interface PlaceGroup<T> {
  place: string;
  assets: T[];
}

/** Where Assets in orbit are grouped, as the table names it. */
const marsOrbit = "Mars orbit";

/**
 * The Assets at Mars grouped by where they are, so that the table needn't say it on every row: those in Mars orbit
 * first, then each Landing Site in the order its first Asset is listed, with each group's Assets in the order given.
 */
export function groupByPlace<T extends { landingSiteName: string | null }>(
  assets: readonly T[],
): PlaceGroup<T>[] {
  const groups = new Map<string, T[]>();
  const orbiting = assets.filter(
    ({ landingSiteName }) => landingSiteName === null,
  );
  if (orbiting.length > 0) groups.set(marsOrbit, orbiting);
  for (const asset of assets) {
    if (asset.landingSiteName === null) continue;
    groups.set(asset.landingSiteName, [
      ...(groups.get(asset.landingSiteName) ?? []),
      asset,
    ]);
  }
  return [...groups].map(([place, grouped]) => ({ place, assets: grouped }));
}
