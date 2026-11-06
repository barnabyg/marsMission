import { parseCatalogue } from "../src/catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
  type TurnSummary,
} from "../src/simulation/simulation";
import { realCatalogueFiles } from "../src/testing/realCatalogue";

/**
 * Seeds and saves for the tests of caching samples and sending them home. Like `seeds.ts`, each searches the real data
 * files for a seed rather than pinning a number.
 */

/** Enough for a rover, then an ascent vehicle and an Earth return orbiter on the Meridian Heavy. Money changes no roll. */
export const sampleReturnMoney = 8000;

const files = realCatalogueFiles();
const rich = createSimulation(
  parseCatalogue({
    ...files,
    program: { ...files.program, startingMoneyMillions: sampleReturnMoney },
  }),
);

/**
 * The Turns of sending samples home, as Planning Mode plays them: a rover on Sample caching lands at Jezero Crater, the
 * Kestrel Lifter lands beside it and the Albatross Orbiter goes to Mars orbit together on the next Turn, and on the
 * third the samples go home, while both still have Service Life left on their shortest.
 */
const sampleReturnPlans: TurnPlan[] = [
  {
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["trailblazer-rover"],
      landingSiteId: "jezero-crater",
      assetChoices: { "trailblazer-rover": { activityId: "sample-caching" } },
    },
  },
  {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["kestrel-ascent-vehicle", "albatross-return-orbiter"],
      landingSiteId: "jezero-crater",
    },
  },
  { mission: null, bringHome: "samples:jezero-crater" },
];

/**
 * The Program on this seed at the start of the third Turn, with the samples ready to go home, or null if the first two
 * Turns didn't play with nothing to answer and nothing lost.
 */
function samplesReady(seed: number): Program | null {
  let program = rich.startProgram(seed);
  for (const plan of sampleReturnPlans.slice(0, 2)) {
    // Something lost on the way leaves a later Turn's plan with nothing to fly.
    if (rich.validatePlan(program, plan).problems.length > 0) return null;
    const progress = rich.workOutTurn(program, plan);
    if (progress.decisionPoint) return null;
    const { summary } = progress.result;
    if (summary.failure || summary.assetsFailed.length > 0) return null;
    program = progress.result.program;
  }
  return program;
}

/** A seed on which the samples get ready to go home over two Turns, and their journey home on the third comes out as `wanted` says. */
function sampleSeedWhere(wanted: (summary: TurnSummary) => boolean): number {
  const [, , sendHome] = sampleReturnPlans;
  for (let seed = 1; seed < 100_000; seed++) {
    const ready = samplesReady(seed);
    if (!ready || !sendHome) continue;
    if (rich.validatePlan(ready, sendHome).problems.length > 0) continue;
    const progress = rich.workOutTurn(ready, sendHome);
    if (!progress.decisionPoint && wanted(progress.result.summary)) {
      return seed;
    }
  }
  throw new Error("No seed sends samples home as wanted");
}

/** A seed on which those three Turns play with nothing to answer, nothing lost, and the samples reach Earth. */
export const sampleReturnSeed = sampleSeedWhere(
  (summary) => summary.samplesHome.length === 1,
);

/** A seed on which the samples get ready over two Turns, and on the third the Kestrel Lifter's Mars ascent fails. */
export const sampleAscentFailureSeed = sampleSeedWhere(
  (summary) =>
    summary.sampleJourney?.failure?.missionEventName === "Mars ascent",
);

/**
 * The automatic save of a Program on this seed at the start of the third Turn, with the samples ready to go home, as the
 * game saves it. It needs the game's data to give the Program sampleReturnMoney, as overrideProgramData does.
 */
export function samplesReadySave(seed: number): string {
  const ready = samplesReady(seed);
  if (!ready)
    throw new Error(`The samples on seed ${String(seed)} aren't ready`);
  return JSON.stringify(rich.saveProgram(ready));
}
