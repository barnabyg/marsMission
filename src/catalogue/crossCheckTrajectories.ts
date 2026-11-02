import { catalogueFileNames, type Catalogue } from "./schemas";

/** Each Trajectory gets its Mission back, or through its Mission Events, within a Turn, and a Free-return has a price. */
export function trajectoryProblems({
  program,
  trajectories,
  missionEvents,
}: Catalogue): string[] {
  const problems: string[] = [];
  const eventIds = new Set(missionEvents.map((event) => event.id));
  const lastAfterArrival = Math.max(
    0,
    ...missionEvents.map(({ timing }) =>
      timing.from === "arrival" ? timing.days : 0,
    ),
  );
  for (const { id: trajectoryId, ...trajectory } of trajectories) {
    const { freeReturn, transferDays, costMillions, capacityLossTonnes } =
      trajectory;
    if (freeReturn) {
      if (!eventIds.has(freeReturn.arrivalBurn)) {
        problems.push(
          `${catalogueFileNames.trajectories}: "${trajectoryId}" refers to the Mission Event "${freeReturn.arrivalBurn}", which isn't in ${catalogueFileNames.missionEvents}`,
        );
      }
      if (costMillions === 0 && capacityLossTonnes === 0) {
        problems.push(
          `${catalogueFileNames.trajectories}: "${trajectoryId}" must cost money or mass capacity, or it would always be the right choice`,
        );
      }
      if (
        transferDays + freeReturn.returnDays >=
        program.launchWindowIntervalDays
      ) {
        problems.push(
          `${catalogueFileNames.trajectories}: "${trajectoryId}" has returnDays too long for the Mission to be back within a Turn of ${program.launchWindowIntervalDays} days`,
        );
      }
    }
    if (transferDays + lastAfterArrival >= program.launchWindowIntervalDays) {
      problems.push(
        `${catalogueFileNames.trajectories}: "${trajectoryId}" has transferDays too long for its Mission Events to finish within a Turn of ${program.launchWindowIntervalDays} days`,
      );
    }
  }
  return problems;
}
