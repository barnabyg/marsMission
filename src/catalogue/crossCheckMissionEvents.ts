import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/** The Mission Events that Launch Vehicles, Assets and Contingencies refer to exist, with at most one Contingency each. */
export function missionEventProblems({
  launchVehicles,
  assets,
  missionEvents,
  contingencies,
}: Catalogue): string[] {
  const problems: string[] = [];
  const eventIds = new Set(missionEvents.map((event) => event.id));
  const eventUsers = [
    [catalogueFileNames.launchVehicles, launchVehicles],
    [catalogueFileNames.assets, assets],
  ] as const;
  for (const [file, items] of eventUsers) {
    for (const item of items) {
      for (const eventId of item.missionEvents) {
        if (!eventIds.has(eventId)) {
          problems.push(
            `${file}: "${item.id}" refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
          );
        }
      }
    }
  }

  for (const { id: contingencyId, missionEvent } of contingencies) {
    if (!eventIds.has(missionEvent)) {
      problems.push(
        `${catalogueFileNames.contingencies}: "${contingencyId}" refers to the Mission Event "${missionEvent}", which isn't in ${catalogueFileNames.missionEvents}`,
      );
    }
  }
  for (const duplicate of findDuplicates(
    contingencies.map(({ missionEvent }) => missionEvent),
  )) {
    problems.push(
      `${catalogueFileNames.contingencies}: the Mission Event "${duplicate}" has more than one Contingency`,
    );
  }
  return problems;
}
