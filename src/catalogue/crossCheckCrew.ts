import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/** The Crewed Mission: its Mission Events, Crew sizes, Activities and names. */
export function crewProblems({
  crew,
  activities,
  missionEvents,
}: Catalogue): string[] {
  const problems: string[] = [];
  const file = catalogueFileNames.crew;
  for (const eventId of crew.missionEvents) {
    const event = missionEvents.find(({ id }) => id === eventId);
    if (!event) {
      problems.push(
        `${file}: the Crewed Mission refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
      );
    } else if (event.failureProbability === "landingSite") {
      problems.push(
        `${file}: the Crewed Mission can't use the Mission Event "${eventId}", which needs a Landing Site, because Crew stay in Mars orbit`,
      );
    }
  }
  crew.sizes.forEach((size, index) => {
    const smaller = crew.sizes[index - 1];
    if (smaller && size.crew <= smaller.crew) {
      problems.push(
        `${file}: a Crew size of ${size.crew} comes after one of ${smaller.crew}. Sizes go in ascending order`,
      );
    }
  });
  for (const activityId of crew.orbitActivities) {
    const activity = activities.find(({ id }) => id === activityId);
    if (!activity) {
      problems.push(
        `${file}: Crew refer to the Activity "${activityId}", which isn't in ${catalogueFileNames.activities}`,
      );
    } else if (activity.effect.kind === "survey") {
      problems.push(
        `${file}: Crew can't do the Activity "${activityId}", because a Survey is for an Asset`,
      );
    }
  }
  for (const duplicate of new Set(findDuplicates(crew.names))) {
    problems.push(`${file}: the name "${duplicate}" is listed more than once`);
  }
  const largest = Math.max(...crew.sizes.map((size) => size.crew));
  if (crew.names.length < largest) {
    problems.push(
      `${file}: there must be at least as many names as the largest Crew size, ${largest}`,
    );
  }
  return problems;
}
