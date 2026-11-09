/**
 * How Assets at Mars are told apart on screen: each of several of the same kind is numbered in the order they arrived,
 * "Pathfinder Orbiter 2", and one on its own keeps its name. The numbers hold from Turn to Turn while the earlier
 * ones last, as each Asset's place in arrival order doesn't change, and close up once one goes.
 */
export function labelsFor(
  assets: readonly { assetId: string; name: string; arrivedOn: string }[],
): string[] {
  const byKind = new Map<string, number[]>();
  assets.forEach(({ assetId }, index) => {
    byKind.set(assetId, [...(byKind.get(assetId) ?? []), index]);
  });
  const labels = assets.map(({ name }) => name);
  for (const indexes of byKind.values()) {
    if (indexes.length < 2) continue;
    // Stable, so that two arriving on the same day keep the order they're listed in.
    const inOrder = indexes.toSorted((first, second) =>
      (assets[first]?.arrivedOn ?? "").localeCompare(
        assets[second]?.arrivedOn ?? "",
      ),
    );
    inOrder.forEach((index, rank) => {
      labels[index] = `${assets[index]?.name ?? ""} ${String(rank + 1)}`;
    });
  }
  return labels;
}
