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
  const { maxHealth } = after.crewedMission;
  const sorted = (names: string[]) => names.toSorted().join();
  const checks: [impossible: boolean, problem: string][] = [
    [
      new Set(namesAfter).size < namesAfter.length,
      "Two Crew members share a name.",
    ],
    // Until Crew can be lost or come home, no one leaves Mars.
    [
      namesBefore.some((name) => !namesAfter.includes(name)),
      "A Crew member at Mars disappeared.",
    ],
    [
      after.crew.some(({ members }) =>
        members.some(({ health }) => health < 0 || health > maxHealth),
      ),
      `A Crew member's Health is outside 0 to ${maxHealth}.`,
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
      arrived.length >
        Math.max(0, ...after.crewedMission.sizes.map(({ crew }) => crew)),
      "More Crew arrived than a Crewed Mission carries.",
    ],
    [
      after.crewedMission.namesLeft !==
        before.crewedMission.namesLeft - arrived.length,
      "The names left to give Crew don't match the Crew who arrived.",
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
