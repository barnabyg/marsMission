import { catalogueFileNames, type Catalogue } from "./schemas";

/** Reliability costs more and fails strictly less at each level up, and the Risk Bands cover every failure probability. */
export function reliabilityProblems({
  reliabilityLevels,
  riskBands,
}: Catalogue): string[] {
  const problems: string[] = [];
  reliabilityLevels.forEach((level, index) => {
    const lower = reliabilityLevels[index - 1];
    if (!lower) return;
    if (level.costMillions < lower.costMillions) {
      problems.push(
        `${catalogueFileNames.reliabilityLevels}: "${level.id}" costs less than "${lower.id}", the level below it`,
      );
    }
    // Strictly less, as Planning Mode tells the player a dearer level in the same Risk Band still lowers the chance.
    if (level.failureMultiplier >= lower.failureMultiplier) {
      problems.push(
        `${catalogueFileNames.reliabilityLevels}: "${level.id}" doesn't fail less often than "${lower.id}", the level below it`,
      );
    }
  });

  riskBands.forEach(({ upTo }, index) => {
    const previous = riskBands[index - 1]?.upTo ?? 0;
    if (upTo <= previous) {
      problems.push(
        `${catalogueFileNames.riskBands}: ${upTo} must be higher than ${previous}. Bands go in ascending order`,
      );
    }
  });
  if (riskBands.at(-1)?.upTo !== 1) {
    problems.push(
      `${catalogueFileNames.riskBands}: the last band must go up to 1, so that every failure probability has a band`,
    );
  }
  return problems;
}
