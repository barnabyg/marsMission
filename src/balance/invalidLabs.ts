import {
  daysBetween,
  type ProgramView,
  type TurnSummary,
} from "../simulation/simulation";

/**
 * Anything impossible about Mars labs over one Turn, read from the Program before it, its summary and the Program
 * after it: what a lab added to a Research Grant is never negative or more than the grant, it raised the grant on
 * some days and no more than the Turn has, only Mars labs operating at Mars during the Turn raised it, and only for
 * Assets or Crew at a Landing Site where one operated.
 */
export function labProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const labIds = new Set(
    after.assets.flatMap(({ id, grantImpact }) =>
      grantImpact === null ? [] : [id],
    ),
  );
  const operating = [...before.operatingAssets, ...after.operatingAssets];
  const labs = operating.filter(({ assetId }) => labIds.has(assetId));
  const labNames = new Set(labs.map(({ name }) => name));
  /** The Landing Sites where a lab operated at the start or the end of the Turn, by id. */
  const labSites = new Set(
    labs.flatMap(({ landingSiteId }) =>
      landingSiteId === null ? [] : [landingSiteId],
    ),
  );
  /** The Assets and Crew at those sites, by the names the Turn summary gives them. */
  const besideLabs = new Set([
    ...operating.flatMap(({ name, landingSiteId }) =>
      landingSiteId !== null && labSites.has(landingSiteId) ? [name] : [],
    ),
    ...after.landingSites.flatMap(({ id, name }) =>
      labSites.has(id) ? [`Crew in ${name}`] : [],
    ),
  ]);
  const turnDays = daysBetween(before.date, after.date);
  const raised = summary.researchGrants.flatMap(
    ({ name, millions, benefit }) =>
      benefit ? [{ name, millions, benefit }] : [],
  );
  const checks: [impossible: boolean, problem: string][] = [
    [
      raised.some(
        ({ millions, benefit }) =>
          benefit.millions < 0 || benefit.millions > millions,
      ),
      "A Mars lab added a negative amount to a Research Grant, or more than the grant.",
    ],
    [
      raised.some(
        ({ benefit }) => benefit.days <= 0 || benefit.days > turnDays,
      ),
      "A Mars lab raised a Research Grant on no days, or on more days than the Turn has.",
    ],
    [
      raised.some(({ benefit }) =>
        benefit.givenBy.some((name) => !labNames.has(name)),
      ),
      "A Research Grant was raised by something that isn't a Mars lab operating at Mars.",
    ],
    [
      raised.some(({ name }) => !besideLabs.has(name)),
      "A Mars lab raised a Research Grant for something at no Landing Site with a lab.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
