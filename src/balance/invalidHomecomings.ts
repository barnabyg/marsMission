import type { ProgramView, TurnSummary } from "../simulation/simulation";

/**
 * Anything impossible about Crew coming home over one Turn, read from the Program before it, its summary and the
 * Program after it: a journey home only for Crew with a way home that isn't barred, who either get home or are lost,
 * the ways home offered only to Crew there to take them, and barred just when their Landing Site lacks the ascent
 * propellant Mars ascent needs.
 */
export function homecomingProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const atMarsBefore = new Set(
    before.crew.flatMap(({ members }) => members.map(({ name }) => name)),
  );
  const withWayHome = new Set(
    before.crew.flatMap(({ waysHome }) =>
      waysHome.flatMap(({ names }) => names),
    ),
  );
  const lost = new Set(summary.crewLost.flatMap(({ names }) => names));
  const home = new Set(summary.crewHome);
  const journey = summary.journeyHome;
  const journeyCrew = journey?.crew ?? [];
  const journeyFailed = (journey?.failure ?? null) !== null;
  const checks: [impossible: boolean, problem: string][] = [
    // Crew who weren't at Mars before can only have come home on a Free-return.
    [
      summary.crewHome.some(
        (name) => atMarsBefore.has(name) && !withWayHome.has(name),
      ),
      "Crew at Mars came home with no way home.",
    ],
    [
      journey !== null &&
        (journey.crew.length === 0 ||
          journey.crew.some((name) => !withWayHome.has(name))),
      "A journey home flew without Crew who had a way home.",
    ],
    [
      journeyCrew.some((name) => home.has(name) === lost.has(name)),
      "A Crew member on a journey home neither came home nor was lost, or did both.",
    ],
    [
      journeyFailed && journeyCrew.some((name) => home.has(name)),
      "Crew came home safe from a journey home that failed.",
    ],
    [
      summary.crewHome.length > 0 !== summary.publicSupportForCrewHome > 0,
      "Crew came home without earning Public Support, or it was earned with no one home.",
    ],
    [
      after.crew.some(({ members, waysHome }) =>
        waysHome.some(
          ({ names }) =>
            names.length === 0 ||
            names.some(
              (name) => !members.some((member) => member.name === name),
            ),
        ),
      ),
      "A way home is offered to Crew who aren't there.",
    ],
    [
      before.crew.some(({ landingSiteId, waysHome }) => {
        const kg =
          before.landingSites.find(({ id }) => id === landingSiteId)
            ?.ascentPropellantKg ?? 0;
        const enough =
          landingSiteId === null ||
          kg >= before.crewedMission.roundTrip.ascentPropellantKg;
        return waysHome.some(({ reason }) => (reason === null) !== enough);
      }),
      "A way home is barred though there is enough ascent propellant for Mars ascent, or offered though there isn't.",
    ],
    [
      before.crew.some(
        ({ waysHome }) =>
          journey !== null &&
          waysHome.some(
            ({ names, reason }) =>
              reason !== null &&
              names.some((name) => journeyCrew.includes(name)),
          ),
      ),
      "A journey home flew for Crew whose way home was barred.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
