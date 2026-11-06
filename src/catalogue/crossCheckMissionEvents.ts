import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/**
 * The Mission Events that Launch Vehicles, Assets and Contingencies refer to exist, with at most one Contingency each,
 * none timed from leaving Mars on the way to Mars, and each Launch Vehicle's Mission Events near Earth happen in a clear
 * order and are over before any arrival.
 */
export function missionEventProblems({
  launchVehicles,
  assets,
  missionEvents,
  contingencies,
  trajectories,
}: Catalogue): string[] {
  const problems: string[] = [];
  const eventIds = new Set(missionEvents.map((event) => event.id));
  const homewardIds = new Set(
    missionEvents
      .filter(({ timing }) => timing.from === "leavingMars")
      .map(({ id }) => id),
  );
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
        } else if (homewardIds.has(eventId)) {
          problems.push(
            `${file}: "${item.id}" brings the Mission Event "${eventId}", which is timed from leaving Mars, on the way to Mars`,
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
  problems.push(
    ...nearEarthProblems(launchVehicles, missionEvents, trajectories),
  );
  return problems;
}

/**
 * Each Launch Vehicle's Mission Events in Earth orbit, timed from launch, have a day each, so that the order they happen
 * in is clear, and with those timed from departure they are over before the shortest Trajectory arrives.
 */
function nearEarthProblems(
  launchVehicles: Catalogue["launchVehicles"],
  missionEvents: Catalogue["missionEvents"],
  trajectories: Catalogue["trajectories"],
): string[] {
  const problems: string[] = [];
  const shortestTransfer = Math.min(
    ...trajectories.map(({ transferDays }) => transferDays),
  );
  for (const vehicle of launchVehicles) {
    const timings = vehicle.missionEvents.flatMap(
      (eventId) =>
        missionEvents.find((event) => event.id === eventId)?.timing ?? [],
    );
    const daysFromLaunch = timings.flatMap(({ from, days }) =>
      from === "launch" ? [days] : [],
    );
    for (const day of findDuplicates(daysFromLaunch.map(String))) {
      problems.push(
        `${catalogueFileNames.launchVehicles}: "${vehicle.id}" has more than one Mission Event in Earth orbit on day ${day} after launch`,
      );
    }
    const departure = 1 + Math.max(0, ...daysFromLaunch);
    const lastNearEarth = Math.max(
      departure - 1,
      ...timings.flatMap(({ from, days }) =>
        from === "departure" ? [departure + days] : [],
      ),
    );
    if (lastNearEarth >= shortestTransfer) {
      problems.push(
        `${catalogueFileNames.launchVehicles}: "${vehicle.id}" has Mission Events near Earth until day ${lastNearEarth}, which must end before the shortest Trajectory arrives, on day ${shortestTransfer}`,
      );
    }
  }
  return problems;
}
