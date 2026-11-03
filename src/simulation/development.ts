import type { Catalogue } from "../catalogue/catalogue";
import { sum } from "./rules";
import { everyTechnology, type Technology } from "./technologyReadiness";
import type { PlannedDevelopment, Program, TurnPlan } from "./types";

/** A technology that isn't built yet, with what its Development costs and takes. */
type NeedsDevelopment = Technology & {
  development: NonNullable<Technology["development"]>;
};

/** Every technology that needs Development before it can fly, Launch Vehicles first, as the Catalogue lists them. */
export function needingDevelopment(catalogue: Catalogue): NeedsDevelopment[] {
  const needsDevelopment = (
    technology: Technology,
  ): technology is NeedsDevelopment =>
    technology.technologyReadiness === "not-built" &&
    technology.development !== undefined;
  return everyTechnology(catalogue).filter(needsDevelopment);
}

/** A technology's Development in this Program, as Planning Mode shows it. */
export function plannedDevelopment(
  program: Program,
  technology: NeedsDevelopment,
): PlannedDevelopment {
  const { costMillions, turns } = technology.development;
  const started = program.developments.find(
    ({ technologyId }) => technologyId === technology.id,
  );
  const turnsLeft = started
    ? Math.max(0, started.finishesOnTurn - program.turnNumber)
    : turns;
  return {
    id: technology.id,
    name: technology.name,
    costMillions,
    turns,
    status: !started ? "notStarted" : turnsLeft > 0 ? "inProgress" : "finished",
    turnsLeft,
  };
}

/** The Developments a plan starts this Turn, what they cost, and what's wrong with starting them, if anything. */
export function developmentsStarting(
  catalogue: Catalogue,
  program: Program,
  developmentIds: string[],
): {
  technologies: NeedsDevelopment[];
  costMillions: number;
  problems: string[];
} {
  const problems: string[] = [];
  const technologies = needingDevelopment(catalogue).filter(
    ({ id }) =>
      developmentIds.includes(id) &&
      !program.developments.some(({ technologyId }) => technologyId === id),
  );
  if (new Set(developmentIds).size < developmentIds.length) {
    problems.push("A plan can't start the same Development twice.");
  }
  for (const id of new Set(developmentIds)) {
    const technology = everyTechnology(catalogue).find(
      (candidate) => candidate.id === id,
    );
    if (!technology) {
      problems.push(`There is no Asset or Launch Vehicle called "${id}".`);
    } else if (technology.technologyReadiness !== "not-built") {
      problems.push(
        `${technology.name} is already built, so it doesn't need Development.`,
      );
    } else if (
      program.developments.some(({ technologyId }) => technologyId === id)
    ) {
      problems.push(`${technology.name}'s Development has already started.`);
    }
  }
  return {
    technologies,
    costMillions: sum(
      technologies.map(({ development }) => development.costMillions),
    ),
    problems,
  };
}

/**
 * The Developments a Turn starts, from a plan that has already passed validation, and those that finish at the start
 * of the next Turn, which may include one just started.
 */
export function carryOutDevelopment(
  catalogue: Catalogue,
  program: Program,
  plan: TurnPlan,
): {
  costMillions: number;
  developments: Program["developments"];
  started: string[];
  finished: string[];
} {
  const { technologies, costMillions } = developmentsStarting(
    catalogue,
    program,
    plan.developmentIds ?? [],
  );
  const developments = [
    ...program.developments,
    ...technologies.map(({ id, development }) => ({
      technologyId: id,
      finishesOnTurn: program.turnNumber + development.turns,
    })),
  ];
  const nextTurn = program.turnNumber + 1;
  return {
    costMillions,
    developments,
    started: technologies.map(({ name }) => name),
    finished: needingDevelopment(catalogue)
      .filter(({ id }) =>
        developments.some(
          ({ technologyId, finishesOnTurn }) =>
            technologyId === id && finishesOnTurn === nextTurn,
        ),
      )
      .map(({ name }) => name),
  };
}
