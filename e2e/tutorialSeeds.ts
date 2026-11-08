import { planningTools, playTurn } from "../src/balance/playProgram";
import { parseCatalogue } from "../src/catalogue/catalogue";
import { createSimulation, type Program } from "../src/simulation/simulation";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { tutorialStatus, tutorialStrategy } from "../src/tutorial/tutorial";

/**
 * Saves for the tests of how the tutorial ends. Like `seeds.ts`, they search the real data files rather than pinning a
 * number, so tuning that moves the route moves them with it.
 */

const simulation = createSimulation(parseCatalogue(realCatalogueFiles()));

const asSave = (program: Program) =>
  JSON.stringify(simulation.saveProgram(program));

/**
 * A Tutorial mode Program at the start of the Turn on which it has landed Crew at a Base, by following the tutorial's
 * advice every Turn, so that continuing it ends the tutorial at its goal.
 */
export const goalReachedSave = (() => {
  for (let seed = 1; seed <= 50; seed++) {
    let program = simulation.startProgram(seed, { tutorial: true });
    for (let turn = 1; turn <= 20; turn++) {
      const view = simulation.readProgram(program);
      const status = tutorialStatus(view);
      if (status.kind === "goalReached") return asSave(program);
      if (status.kind === "cantRecover") break;
      const plan = tutorialStrategy.plan(
        view,
        planningTools(simulation, program),
      );
      program = playTurn(
        simulation,
        tutorialStrategy,
        program,
        view,
        plan,
      ).program;
    }
  }
  throw new Error("No seed from 1 to 50 follows the tutorial to its goal.");
})();

/**
 * A Tutorial mode Program on its first Turn with too little money and Public Support for the route to recover, so that
 * continuing it ends the tutorial as one that can't recover.
 */
export const cantRecoverSave = (() => {
  const program: Program = {
    ...simulation.startProgram(1, { tutorial: true }),
    moneyMillions: 400,
  };
  if (tutorialStatus(simulation.readProgram(program)).kind !== "cantRecover") {
    throw new Error("The tutorial would carry on with this Program.");
  }
  return asSave(program);
})();
