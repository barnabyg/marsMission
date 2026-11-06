import { findDuplicates } from "./crossCheckIds";
import { catalogueFileNames, type Catalogue } from "./schemas";

/**
 * The Crewed Mission: its Mission Events to Mars orbit, to a Landing Site and home from a round trip, Crew sizes,
 * Health, Supplies, Protection, Activities and names.
 */
export function crewProblems({
  crew,
  activities,
  missionEvents,
  program,
}: Catalogue): string[] {
  const problems: string[] = [];
  const file = catalogueFileNames.crew;
  const eventFor = (eventId: string) => {
    const event = missionEvents.find(({ id }) => id === eventId);
    if (!event) {
      problems.push(
        `${file}: the Crewed Mission refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
      );
    } else if (event.timing.from === "leavingMars") {
      problems.push(
        `${file}: the Crewed Mission brings the Mission Event "${eventId}", which is timed from leaving Mars, on the way to Mars`,
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
  const { safeModeLoss, hitLoss } = crew.health.solarParticleEvent;
  if (hitLoss < safeModeLoss) {
    problems.push(
      `${file}: a solar particle event that hits costs ${hitLoss} Health, which must be no less than the ${safeModeLoss} that safe mode costs`,
    );
  }
  if (hitLoss >= crew.maxHealth) {
    problems.push(
      `${file}: a solar particle event that hits costs ${hitLoss} Health, which must be less than the ${crew.maxHealth} Crew start with`,
    );
  }
  problems.push(...protectionProblems(crew.protection));
  problems.push(
    ...roundTripProblems(
      crew.roundTrip,
      missionEvents,
      program.launchWindowIntervalDays,
    ),
  );
  const largest = Math.max(...crew.sizes.map((size) => size.crew));
  if (crew.names.length < largest) {
    problems.push(
      `${file}: there must be at least as many names as the largest Crew size, ${largest}`,
    );
  }
  return problems;
}

/** Protection levels go from none to the most, each slowing radiation's harm more than the one before, so more is never worse. */
function protectionProblems(
  protection: Catalogue["crew"]["protection"],
): string[] {
  const file = catalogueFileNames.crew;
  const problems: string[] = [];
  const [first] = protection;
  if (first && first.radiationCutPercent !== 0) {
    problems.push(
      `${file}: the first Protection level, "${first.id}", must slow radiation's harm by 0%, as a Crewed Mission has it unless the player buys more`,
    );
  }
  protection.forEach((level, index) => {
    const less = protection[index - 1];
    if (less && level.radiationCutPercent <= less.radiationCutPercent) {
      problems.push(
        `${file}: the Protection level "${level.id}" slows radiation's harm by no more than "${less.id}" before it. Levels go from least Protection to most`,
      );
    }
  });
  for (const duplicate of new Set(
    findDuplicates(protection.map(({ id }) => id)),
  )) {
    problems.push(
      `${file}: the Protection level "${duplicate}" is listed more than once`,
    );
  }
  return problems;
}

/**
 * A round trip's journey home: Mission Events that exist, each timed from leaving Mars, none needing a Landing Site, and
 * home before the Turn it leaves in ends.
 */
function roundTripProblems(
  roundTrip: Catalogue["crew"]["roundTrip"],
  missionEvents: Catalogue["missionEvents"],
  turnDays: number,
): string[] {
  const file = catalogueFileNames.crew;
  const problems: string[] = [];
  let lastDays = 0;
  for (const eventId of roundTrip.missionEvents) {
    const event = missionEvents.find(({ id }) => id === eventId);
    if (!event) {
      problems.push(
        `${file}: the round trip refers to the Mission Event "${eventId}", which isn't in ${catalogueFileNames.missionEvents}`,
      );
      continue;
    }
    if (event.timing.from !== "leavingMars") {
      problems.push(
        `${file}: the round trip brings the Mission Event "${eventId}" on the way home, but it isn't timed from leaving Mars`,
      );
    }
    if (event.failureProbability === "landingSite") {
      problems.push(
        `${file}: the round trip can't use the Mission Event "${eventId}" on the way home, because it needs a Landing Site`,
      );
    }
    lastDays = Math.max(lastDays, event.timing.days);
  }
  for (const duplicate of new Set(findDuplicates(roundTrip.missionEvents))) {
    problems.push(
      `${file}: the round trip lists the Mission Event "${duplicate}" more than once`,
    );
  }
  const homeOn = roundTrip.leavesMarsOnDay + lastDays;
  if (homeOn >= turnDays) {
    problems.push(
      `${file}: the journey home ends on day ${homeOn} of the Turn, which must be before the Turn ends on day ${turnDays}`,
    );
  }
  return problems;
}
