import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { sum } from "./sum";

/**
 * Anything impossible about samples over one Turn, read from the Program before it, its summary and the Program after
 * it: no Landing Site holds a negative or fractional count, or samples it isn't a known site for; each site holds what
 * it had less any taken home, with what was cached there; only rovers cache them; samples that reached Earth were at
 * their site as the Turn started, or flew with Crew, and earned the Catalogue's Science each; and samples went home
 * only one way in a Turn.
 */
export function sampleProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const samplesBefore = new Map(
    before.landingSites.map(({ name, samples }) => [name, samples]),
  );
  const cachedAt = new Map(
    summary.samplesCached.map(({ siteName, samples }) => [siteName, samples]),
  );
  const rovers = new Set(
    [...before.operatingAssets, ...after.operatingAssets].flatMap(
      ({ name, kind }) => (kind === "rover" ? [name] : []),
    ),
  );
  const home = summary.samplesHome;
  const robotic = home.filter(({ broughtBy }) => broughtBy !== "Crew");
  const left = summary.sampleJourney && !summary.sampleJourney.stayed;
  const takenFrom = new Set([
    ...home.map(({ from }) => from),
    ...(left ? [summary.sampleJourney?.siteName ?? ""] : []),
    ...(summary.journeyHome?.samplesFrom
      ? [summary.journeyHome.samplesFrom]
      : []),
  ]);
  const [first] = home;
  const perSample = first ? first.science / first.samples : 0;
  const checks: [impossible: boolean, problem: string][] = [
    [
      after.landingSites.some(
        ({ samples }) => samples < 0 || !Number.isInteger(samples),
      ),
      "A Landing Site holds a negative or fractional number of samples.",
    ],
    [
      summary.samplesCached.some(
        ({ samples, cachedBy }) =>
          samples <= 0 || cachedBy.some((name) => !rovers.has(name)),
      ),
      "Samples were cached by something that isn't a rover, or none were.",
    ],
    [
      after.landingSites.some(({ name, samples }) => {
        const was = takenFrom.has(name) ? 0 : (samplesBefore.get(name) ?? 0);
        return samples !== was + (cachedAt.get(name) ?? 0);
      }),
      "A Landing Site's samples aren't what it had, less any taken home, with what was cached there.",
    ],
    [
      robotic.some(
        ({ from, samples }) => samples !== (samplesBefore.get(from) ?? 0),
      ),
      "An Earth return orbiter brought home other than the samples at their Landing Site as the Turn started.",
    ],
    [
      robotic.length > 0 && summary.journeyHome !== null,
      "Samples went home aboard an Earth return orbiter in a Turn when Crew flew a journey home too.",
    ],
    [
      home.some(({ samples, science }) => science !== samples * perSample),
      "Samples home didn't each earn the same Science.",
    ],
    [
      sum(home.map(({ science }) => science)) > summary.scienceGained,
      "Samples home earned more Science than the Turn gained.",
    ],
    [
      summary.sampleJourney !== null &&
        summary.sampleJourney.failure !== null &&
        robotic.length > 0,
      "Samples came home from a journey that failed.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
