import { catalogueFileNames, type Catalogue } from "./schemas";

/** Each Hazard fits within a Turn and the Trajectories, and the cautious answer to it can be worth taking. */
export function hazardProblems({
  program,
  trajectories,
  hazards,
}: Catalogue): string[] {
  const problems: string[] = [];
  const { dustStorm } = hazards;
  if (dustStorm.minDays > dustStorm.maxDays) {
    problems.push(
      `${catalogueFileNames.hazards}: dustStorm has minDays above maxDays`,
    );
  }
  // It starts after the Turn does and clears before the Turn ends, so a landing held off for it stays within the Turn.
  if (dustStorm.maxDays > program.launchWindowIntervalDays - 2) {
    problems.push(
      `${catalogueFileNames.hazards}: dustStorm has maxDays too long for a storm to clear within a Turn of ${program.launchWindowIntervalDays} days`,
    );
  }

  if (dustStorm.landingRiskMultiplier <= 1) {
    problems.push(
      `${catalogueFileNames.hazards}: dustStorm must raise a landing's risk with a landingRiskMultiplier above 1, or holding off would never be worth it`,
    );
  }

  const { solarParticleEvent } = hazards;
  const longestTransfer = Math.max(
    ...trajectories.map(({ transferDays }) => transferDays),
  );
  // Above this, every Mission on the longest Trajectory would meet one, so a longer Duration couldn't be more exposed.
  if (solarParticleEvent.chancePerDayInFlight * longestTransfer > 1) {
    problems.push(
      `${catalogueFileNames.hazards}: solarParticleEvent has chancePerDayInFlight too high for the longest Trajectory, of ${longestTransfer} days`,
    );
  }
  if (
    solarParticleEvent.damageServiceLifeLossPercent <=
    solarParticleEvent.safeModeServiceLifeLossPercent
  ) {
    problems.push(
      `${catalogueFileNames.hazards}: solarParticleEvent must cost more Service Life in damageServiceLifeLossPercent than in safeModeServiceLifeLossPercent, or safe mode would never be worth it`,
    );
  }
  return problems;
}
