import type { z } from "zod";
import { assetProblems } from "./crossCheckAssets";
import { benefitProblems } from "./crossCheckBenefits";
import { crewProblems } from "./crossCheckCrew";
import { hazardProblems } from "./crossCheckHazards";
import { idProblems } from "./crossCheckIds";
import { milestoneProblems } from "./crossCheckMilestones";
import { missionEventProblems } from "./crossCheckMissionEvents";
import { reliabilityProblems } from "./crossCheckReliability";
import { technologyProblems } from "./crossCheckTechnology";
import { trajectoryProblems } from "./crossCheckTrajectories";
import { catalogueFileNames, schemas, type Catalogue } from "./schemas";

export { catalogueFileNames, isoDate, type Catalogue } from "./schemas";

export type CatalogueFiles = Catalogue;

/** Thrown when the data files are invalid. The message says which file and field to fix. */
export class CatalogueError extends Error {
  override name = "CatalogueError";
}

function parsePart<T>(
  file: string,
  schema: z.ZodType<T>,
  raw: unknown,
  problems: string[],
): T | undefined {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    problems.push(`${file}: ${path === "" ? "" : `${path}: `}${issue.message}`);
  }
  return undefined;
}

/** The checks of the data files against each other, one subject each, in the order their problems are listed. */
const crossChecks: ((catalogue: Catalogue) => string[])[] = [
  idProblems,
  missionEventProblems,
  hazardProblems,
  assetProblems,
  milestoneProblems,
  reliabilityProblems,
  trajectoryProblems,
  technologyProblems,
  benefitProblems,
  crewProblems,
];

/** Validates the raw contents of the data files and returns the catalogue, or throws a CatalogueError. */
export function parseCatalogue(files: CatalogueFiles): Catalogue {
  const problems: string[] = [];
  const program = parsePart(
    catalogueFileNames.program,
    schemas.program,
    files.program,
    problems,
  );
  const activities = parsePart(
    catalogueFileNames.activities,
    schemas.activities,
    files.activities,
    problems,
  );
  const researchKinds = parsePart(
    catalogueFileNames.researchKinds,
    schemas.researchKinds,
    files.researchKinds,
    problems,
  );
  const launchVehicles = parsePart(
    catalogueFileNames.launchVehicles,
    schemas.launchVehicles,
    files.launchVehicles,
    problems,
  );
  const trajectories = parsePart(
    catalogueFileNames.trajectories,
    schemas.trajectories,
    files.trajectories,
    problems,
  );
  const assets = parsePart(
    catalogueFileNames.assets,
    schemas.assets,
    files.assets,
    problems,
  );
  const crew = parsePart(
    catalogueFileNames.crew,
    schemas.crew,
    files.crew,
    problems,
  );
  const landingSites = parsePart(
    catalogueFileNames.landingSites,
    schemas.landingSites,
    files.landingSites,
    problems,
  );
  const missionEvents = parsePart(
    catalogueFileNames.missionEvents,
    schemas.missionEvents,
    files.missionEvents,
    problems,
  );

  const contingencies = parsePart(
    catalogueFileNames.contingencies,
    schemas.contingencies,
    files.contingencies,
    problems,
  );

  const hazards = parsePart(
    catalogueFileNames.hazards,
    schemas.hazards,
    files.hazards,
    problems,
  );

  const milestones = parsePart(
    catalogueFileNames.milestones,
    schemas.milestones,
    files.milestones,
    problems,
  );

  const fundingThresholds = parsePart(
    catalogueFileNames.fundingThresholds,
    schemas.fundingThresholds,
    files.fundingThresholds,
    problems,
  );

  const reliabilityLevels = parsePart(
    catalogueFileNames.reliabilityLevels,
    schemas.reliabilityLevels,
    files.reliabilityLevels,
    problems,
  );

  const riskBands = parsePart(
    catalogueFileNames.riskBands,
    schemas.riskBands,
    files.riskBands,
    problems,
  );

  if (
    !program ||
    !activities ||
    !researchKinds ||
    !launchVehicles ||
    !trajectories ||
    !assets ||
    !crew ||
    !landingSites ||
    !missionEvents ||
    !contingencies ||
    !hazards ||
    !milestones ||
    !fundingThresholds ||
    !reliabilityLevels ||
    !riskBands
  ) {
    throw new CatalogueError(problems.join("\n"));
  }

  const catalogue = {
    program,
    activities,
    researchKinds,
    launchVehicles,
    trajectories,
    assets,
    crew,
    landingSites,
    missionEvents,
    contingencies,
    hazards,
    milestones,
    fundingThresholds,
    reliabilityLevels,
    riskBands,
  };
  const crossCheckProblems = crossChecks.flatMap((check) => check(catalogue));
  if (crossCheckProblems.length > 0) {
    throw new CatalogueError(crossCheckProblems.join("\n"));
  }
  return catalogue;
}
