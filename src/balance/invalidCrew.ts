import type { ProgramView, TurnSummary } from "../simulation/simulation";

/** Anything impossible about the Crew over one Turn, read from the Program before it, its summary and the Program after it. */
export function crewProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const namesOf = (view: ProgramView) =>
    view.crew.flatMap(({ members }) => members.map(({ name }) => name));
  const namesBefore = namesOf(before);
  const namesAfter = namesOf(after);
  const arrived = namesAfter.filter((name) => !namesBefore.includes(name));
  const lost = summary.crewLost.flatMap(({ names }) => names);
  const gone = [...lost, ...summary.crewHome];
  // Crew lost on the way, or brought home, never reached Mars, but their names have been given.
  const flown = [
    ...arrived,
    ...gone.filter((name) => !namesBefore.includes(name)),
  ];
  const { maxHealth } = after.crewedMission;
  const sorted = (names: string[]) => names.toSorted().join();
  const crewPlaces = new Set(
    [...before.crew, ...after.crew].map(
      ({ locationName }) => `Crew in ${locationName}`,
    ),
  );
  // Health only falls by what the Turn summary says each one lost: from what they had at Mars, or from full if they flew.
  const healthBefore = new Map(
    before.crew.flatMap(({ members }) =>
      members.map(({ name, health }) => [name, health] as const),
    ),
  );
  const startOf = (name: string) => healthBefore.get(name) ?? maxHealth;
  const lostBy = (name: string) =>
    summary.healthLost
      .filter((member) => member.name === name)
      .flatMap(({ lost }) => lost)
      .reduce((total, { health }) => total + health, 0);
  const diedOfHealth = summary.crewLost
    .filter(({ cause }) => cause === "health")
    .flatMap(({ names }) => names);
  const membersAfter = after.crew.flatMap(({ members }) => members);
  const checks: [impossible: boolean, problem: string][] = [
    [
      new Set(namesAfter).size < namesAfter.length,
      "Two Crew members share a name.",
    ],
    [
      new Set(gone).size < gone.length,
      "A Crew member was lost or brought home twice.",
    ],
    // Only being lost or brought home takes Crew away from Mars.
    [
      namesBefore.some(
        (name) => !namesAfter.includes(name) && !gone.includes(name),
      ),
      "A Crew member at Mars disappeared.",
    ],
    [
      gone.some(
        (name) =>
          namesAfter.includes(name) ||
          summary.crew.some((member) => member.name === name),
      ),
      "A Crew member who is lost or home still operates at Mars.",
    ],
    [
      summary.ongoingResearch.some(
        ({ assetName }) =>
          assetName.startsWith("Crew in ") && !crewPlaces.has(assetName),
      ),
      "Crew earned Ongoing Research where no Crew operate.",
    ],
    [
      summary.crewLost.some(
        ({ names, publicSupportLost }) =>
          names.length === 0 || publicSupportLost < 0,
      ),
      "Losing Crew lost no one, or gained Public Support.",
    ],
    [
      after.crew.some(({ members }) =>
        members.some(({ health }) => health < 0 || health > maxHealth),
      ),
      `A Crew member's Health is outside 0 to ${maxHealth}.`,
    ],
    [
      membersAfter.some(({ health }) => health === 0) ||
        summary.crew.some(({ health }) => health === 0),
      "A Crew member at zero Health still operates at Mars.",
    ],
    [
      summary.healthLost.some(({ lost }) =>
        lost.some(({ health }) => health <= 0),
      ),
      "A Crew member lost no Health, or gained some, to a cause.",
    ],
    [
      membersAfter.some(
        ({ name, health }) => health !== startOf(name) - lostBy(name),
      ),
      "A Crew member's Health doesn't match what the Turn summary says they lost.",
    ],
    [
      diedOfHealth.some((name) => lostBy(name) !== startOf(name)),
      "A Crew member died of their Health without losing all of it.",
    ],
    [
      after.crew.some(
        ({ members, activityId, activities }) =>
          members.length === 0 ||
          !activities.some(({ id }) => id === activityId),
      ),
      "Crew at Mars have no one there, or an Activity they can't do.",
    ],
    [
      new Set(after.crew.map(({ key }) => key)).size < after.crew.length,
      "The Crew in one place are listed twice.",
    ],
    [
      flown.length >
        Math.max(0, ...after.crewedMission.sizes.map(({ crew }) => crew)),
      "More Crew flew than a Crewed Mission carries.",
    ],
    [
      after.crewedMission.namesLeft !==
        before.crewedMission.namesLeft - flown.length,
      "The names left to give Crew don't match the Crew who flew.",
    ],
    [
      sorted(summary.crew.map(({ name }) => name)) !== sorted(namesAfter) ||
        sorted(
          summary.crew
            .filter((member) => member.arrived)
            .map(({ name }) => name),
        ) !== sorted(arrived),
      "The Crew in the Turn summary don't match the Crew at Mars.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
