import { catalogueFileNames, type Catalogue } from "./schemas";

export function findDuplicates(ids: string[]): string[] {
  return ids.filter((value, index) => ids.indexOf(value) !== index);
}

/** Each id is used once in its file. */
export function idProblems({
  activities,
  researchKinds,
  launchVehicles,
  trajectories,
  assets,
  landingSites,
  missionEvents,
  contingencies,
  milestones,
  reliabilityLevels,
}: Catalogue): string[] {
  const problems: string[] = [];
  const parts = [
    [catalogueFileNames.activities, activities],
    [catalogueFileNames.researchKinds, researchKinds],
    [catalogueFileNames.launchVehicles, launchVehicles],
    [catalogueFileNames.trajectories, trajectories],
    [catalogueFileNames.assets, assets],
    [catalogueFileNames.landingSites, landingSites],
    [catalogueFileNames.missionEvents, missionEvents],
    [catalogueFileNames.contingencies, contingencies],
    [catalogueFileNames.milestones, milestones],
    [catalogueFileNames.reliabilityLevels, reliabilityLevels],
  ] as const;
  for (const [file, items] of parts) {
    for (const duplicate of findDuplicates(items.map((item) => item.id))) {
      problems.push(`${file}: the id "${duplicate}" is used more than once`);
    }
  }
  return problems;
}
