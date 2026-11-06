import type { ProgramView, TurnSummary } from "../simulation/simulation";
import { sum } from "./sum";

/**
 * Anything impossible about habitats over one Turn, read from the Program before it, its summary and the Program after
 * it: the Supplies held at each Landing Site are never negative and no more than the habitats operating there hold, a
 * site with none operating holds none, and Health saved by a habitat is more than nothing and only goes to Crew at a
 * Landing Site that had one.
 */
export function habitatProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const holds = new Map(
    after.assets.flatMap(({ id, habitat }) =>
      habitat ? [[id, habitat.suppliesKg] as const] : [],
    ),
  );
  /** What the habitats operating at this site as the Turn ends hold together. */
  const holdsAt = (siteId: string) =>
    sum(
      after.operatingAssets
        .filter(({ landingSiteId }) => landingSiteId === siteId)
        .map(({ assetId }) => holds.get(assetId) ?? 0),
    );
  /** The Landing Sites where a habitat operated at the start or the end of the Turn, by id. */
  const housedSites = new Set(
    [...before.operatingAssets, ...after.operatingAssets].flatMap(
      ({ assetId, landingSiteId }) =>
        holds.has(assetId) && landingSiteId !== null ? [landingSiteId] : [],
    ),
  );
  /** The Crew at those sites as the Turn starts or ends, or lost there, by name. */
  const housedCrew = new Set(
    [...before.crew, ...after.crew]
      .filter(
        ({ landingSiteId }) =>
          landingSiteId !== null && housedSites.has(landingSiteId),
      )
      .flatMap(({ members }) => members.map(({ name }) => name)),
  );
  const lost = new Set(summary.crewLost.flatMap(({ names }) => names));
  const saved = summary.healthLost.filter(
    ({ savedByHabitat }) => savedByHabitat !== undefined,
  );
  const checks: [impossible: boolean, problem: string][] = [
    [
      after.landingSites.some(
        ({ habitatSuppliesKg }) =>
          !Number.isFinite(habitatSuppliesKg) || habitatSuppliesKg < 0,
      ),
      "A Landing Site's habitats hold a negative amount of Supplies.",
    ],
    [
      after.landingSites.some(
        ({ id, habitatSuppliesKg }) => habitatSuppliesKg > holdsAt(id),
      ),
      "A Landing Site's habitats hold more Supplies than the habitats operating there can.",
    ],
    [
      saved.some(({ savedByHabitat = 0 }) => savedByHabitat <= 0),
      "A habitat saved a Crew member no Health, or cost them some.",
    ],
    [
      saved.some(({ name }) => !housedCrew.has(name) && !lost.has(name)),
      "A habitat saved Health for a Crew member at no Landing Site with a habitat.",
    ],
    [
      saved.length > 0 && housedSites.size === 0,
      "A habitat saved Health with no habitat operating at Mars.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
