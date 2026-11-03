import type { Catalogue } from "../catalogue/catalogue";
import type { Program } from "./types";

/** An Asset or a Launch Vehicle: anything with a Technology Readiness. */
export type Technology =
  Catalogue["assets"][number] | Catalogue["launchVehicles"][number];

export type TechnologyReadiness = Technology["technologyReadiness"];

/** Whether a technology can be chosen for a Mission, which it can't until its Development has finished. */
export function canFly({
  technologyReadiness,
}: {
  technologyReadiness: TechnologyReadiness;
}): boolean {
  return technologyReadiness !== "not-built";
}

/** Whether a technology's Development has finished in this Program, which is at the start of the Turn it was due. */
function isDeveloped(program: Program, technology: Technology): boolean {
  return program.developments.some(
    ({ technologyId, finishesOnTurn }) =>
      technologyId === technology.id && finishesOnTurn <= program.turnNumber,
  );
}

/**
 * How mature a technology is in this Program: as the Catalogue starts it, built once its Development has finished,
 * or Flight-proven once it has been used successfully.
 */
export function readinessOf(
  program: Program,
  technology: Technology,
): TechnologyReadiness {
  if (program.provenTechnologyIds.includes(technology.id)) {
    return "flight-proven";
  }
  return technology.technologyReadiness === "not-built" &&
    isDeveloped(program, technology)
    ? "built"
    : technology.technologyReadiness;
}

export function isFlightProven(
  program: Program,
  technology: Technology,
): boolean {
  return readinessOf(program, technology) === "flight-proven";
}

/** What a technology costs in this Program, which is more until it is Flight-proven. */
export function costOf(program: Program, technology: Technology): number {
  return isFlightProven(program, technology)
    ? technology.costMillions
    : (technology.unproven?.costMillions ?? technology.costMillions);
}

/** What the failure probabilities a technology brings are multiplied by in this Program, which is more than 1 until it is Flight-proven. */
export function unprovenMultiplier(
  program: Program,
  technology: Technology,
): number {
  return isFlightProven(program, technology)
    ? 1
    : (technology.unproven?.failureMultiplier ?? 1);
}
