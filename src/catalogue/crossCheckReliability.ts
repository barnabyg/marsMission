import { catalogueFileNames, type Catalogue } from "./schemas";

/** Reliability costs more and fails less at each level up, and the Risk Bands cover every failure probability. */
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
    if (level.failureMultiplier > lower.failureMultiplier) {
      problems.push(
        `${catalogueFileNames.reliabilityLevels}: "${level.id}" has a higher failure probability than "${lower.id}", the level below it`,
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
