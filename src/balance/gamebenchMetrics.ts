import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import { playBalancePrograms } from "./balanceRuns";
import { goalSummary } from "./goalReport";
import { strategies } from "./strategies";

export function gamebenchBalanceSuite(files: CatalogueFiles) {
  const simulation = createSimulation(parseCatalogue(files));
  const metrics = strategies.flatMap((strategy) => {
    const { goal } = strategy;
    if (!goal) return [];

    const plays = playBalancePrograms(simulation, strategy, 1000);
    const { attempts, completed, medianTurn } = goalSummary(plays);
    return [
      {
        id: `${goal.id}.goal-completion`,
        label: `${goal.label} goal completion`,
        value: (100 * completed) / attempts,
        unit: "percent",
        sampleSize: attempts,
      },
      {
        id: `${goal.id}.median-goal-turn`,
        label: `${goal.label} median goal turn`,
        value: medianTurn,
        unit: "turns",
        sampleSize: completed,
      },
    ];
  });

  return { id: "mars-mission-balance", version: 1, area: "balance", metrics };
}
