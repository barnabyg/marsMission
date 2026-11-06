import type { ProgramView, TurnSummary } from "../simulation/simulation";

/**
 * Anything impossible about fetching Crew with a return vehicle over one Turn, read from the Program before it, its
 * summary and the Program after it: every Crew member at Mars either has one way home or none, a return vehicle waits
 * only for Crew who had none, as many as it has room for, and Crew who had no way home only gain one from it.
 */
export function fetchingProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const waysHomeOf = (view: ProgramView) =>
    view.crew.flatMap(({ waysHome }) => waysHome.flatMap(({ names }) => names));
  const strandedBefore = new Set(
    before.crew.flatMap(({ withoutWayHome }) => withoutWayHome),
  );
  const fetched = summary.returnVehicle?.crew ?? [];
  const withWayHomeAfter = waysHomeOf(after);
  const checks: [impossible: boolean, problem: string][] = [
    [
      new Set(withWayHomeAfter).size < withWayHomeAfter.length,
      "A Crew member at Mars has more than one way home.",
    ],
    [
      after.crew.some(
        ({ members, waysHome, withoutWayHome }) =>
          members.length !==
            withoutWayHome.length +
              waysHome.reduce((total, { names }) => total + names.length, 0) ||
          withoutWayHome.some((name) =>
            waysHome.some(({ names }) => names.includes(name)),
          ),
      ),
      "A Crew member at Mars is listed both with and without a way home, or neither.",
    ],
    [
      fetched.some((name) => !strandedBefore.has(name)),
      "A return vehicle waits for Crew who had a way home already, or weren't at Mars.",
    ],
    [
      fetched.length > before.crewedMission.returnVehicle.crewRoom,
      "A return vehicle waits for more Crew than it has room for.",
    ],
    [
      withWayHomeAfter.some(
        (name) => strandedBefore.has(name) && !fetched.includes(name),
      ),
      "Crew with no way home gained one without a return vehicle.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
