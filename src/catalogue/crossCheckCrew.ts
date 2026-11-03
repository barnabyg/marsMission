import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/** The Crewed Mission: its Mission Events to Mars orbit and to a Landing Site, Crew sizes, Health, Supplies, Activities and names. */
export function crewProblems({
  crew,
  activities,
  missionEvents,
}: Catalogue): string[] {
  const problems: string[] = [];
  const file = catalogueFileNames.crew;
  const eventFor = (eventId: string) => {
    const event = missionEvents.find(({ id }) => id === eventId);
    if (!event) {
      problems.push(
        `${file}: the Crewed Mission refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
      );
    }
    return event;
  };
  for (const eventId of crew.missionEvents) {
    if (eventFor(eventId)?.failureProbability === "landingSite") {
      problems.push(
        `${file}: the Crewed Mission can't use the Mission Event "${eventId}" to reach Mars orbit, because it needs a Landing Site`,
      );
    }
  }
  for (const eventId of crew.landingMissionEvents) eventFor(eventId);
  crew.sizes.forEach((size, index) => {
    const smaller = crew.sizes[index - 1];
    if (smaller && size.crew <= smaller.crew) {
      problems.push(
        `${file}: a Crew size of ${size.crew} comes after one of ${smaller.crew}. Sizes go in ascending order`,
      );
    }
  });
  for (const activityId of [
    ...crew.orbitActivities,
    ...crew.surfaceActivities,
  ]) {
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
  const { contingencyRescueLoss, dustStorm } = crew.health;
  if (contingencyRescueLoss >= crew.maxHealth) {
    problems.push(
      `${file}: a Contingency rescue costs ${contingencyRescueLoss} Health, which must be less than the ${crew.maxHealth} Crew start with`,
    );
  }
  if (dustStorm.loss >= crew.maxHealth) {
    problems.push(
      `${file}: being hurt in a dust storm costs ${dustStorm.loss} Health, which must be less than the ${crew.maxHealth} Crew start with`,
    );
  }
  crew.supplies.options.forEach((option, index) => {
    const less = crew.supplies.options[index - 1];
    if (less && option.massTonnes <= less.massTonnes) {
      problems.push(
        `${file}: the Supplies "${option.id}" weigh no more than "${less.id}" before them. Supplies go from least to most`,
      );
    }
  });
  for (const duplicate of new Set(
    findDuplicates(crew.supplies.options.map(({ id }) => id)),
  )) {
    problems.push(
      `${file}: the Supplies "${duplicate}" are listed more than once`,
    );
  }
  const largest = Math.max(...crew.sizes.map((size) => size.crew));
  if (crew.names.length < largest) {
    problems.push(
      `${file}: there must be at least as many names as the largest Crew size, ${largest}`,
    );
  }
  return problems;
}
