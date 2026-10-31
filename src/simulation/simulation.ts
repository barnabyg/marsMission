import type { Catalogue } from "../catalogue/catalogue";
import { createRules, formatMoney, sum } from "./rules";
import { restoreProgram, saveProgram, type SavedProgram } from "./saveFormat";
import { resolveTurn } from "./turnSteps";
import type {
  PlanCheck,
  PlannedMission,
  PlannedMissionEvent,
  Program,
  ProgramView,
  TurnPlan,
  TurnResult,
} from "./types";

export { addDays, formatMoney } from "./rules";
export { corruptSave, SaveError } from "./saveFormat";
export type {
  AssetAtMars,
  Program,
  ProgramView,
  Timeline,
  TimelineEntry,
  TurnPlan,
  TurnResult,
  TurnSummary,
} from "./types";

export interface Simulation {
  startProgram(seed: number): Program;
  /** A Program as data that can be kept and given to restoreProgram later. */
  saveProgram(program: Program): SavedProgram;
  /** The Program in a save, which plays on as if it was never saved. Throws a SaveError if it can't be continued. */
  restoreProgram(saved: unknown): Program;
  readProgram(program: Program): ProgramView;
  validatePlan(program: Program, plan: TurnPlan): PlanCheck;
  /** The Mission Events a Mission would go through, in order. Ids that aren't in the catalogue are skipped. */
  previewMission(
    program: Program,
    mission: PlannedMission,
  ): PlannedMissionEvent[];
  runTurn(program: Program, plan: TurnPlan): TurnResult;
  retireProgram(program: Program): Program;
}

const noMission = { costMillions: 0, massTonnes: 0, capacityTonnes: 0 };

export function createSimulation(catalogue: Catalogue): Simulation {
  const rules = createRules(catalogue);
  const {
    failureProbability,
    knownLandingSites,
    landingSiteById,
    missionEventsFor,
    reliabilityLevelFor,
    riskBandFor,
  } = rules;

  function checkPlan(program: Program, plan: TurnPlan): PlanCheck {
    if (program.status.kind !== "active") {
      return { ...noMission, problems: ["This Program has ended."] };
    }
    if (!plan.mission) return { ...noMission, problems: [] };

    const {
      launchVehicleId,
      assetIds,
      reliability = {},
      landingSiteId,
    } = plan.mission;
    const problems: string[] = [];
    let costMillions = 0;
    let massTonnes = 0;

    const vehicle = catalogue.launchVehicles.find(
      (candidate) => candidate.id === launchVehicleId,
    );
    if (vehicle) costMillions += vehicle.costMillions;
    else
      problems.push(`There is no Launch Vehicle called "${launchVehicleId}".`);

    if (assetIds.length === 0) {
      problems.push("A Mission must carry at least one Asset.");
    }
    if (new Set(assetIds).size < assetIds.length) {
      problems.push("A Mission can't carry the same Asset twice.");
    }
    for (const assetId of assetIds) {
      const asset = catalogue.assets.find(
        (candidate) => candidate.id === assetId,
      );
      if (asset) {
        costMillions += asset.costMillions;
        massTonnes += asset.massTonnes;
      } else problems.push(`There is no Asset called "${assetId}".`);
    }
    // Masses like 0.1 and 0.2 don't add up exactly, and a Mission at exactly its capacity must fit.
    massTonnes = Math.round(massTonnes * 1000) / 1000;
    const capacityTonnes = vehicle?.capacityTonnes ?? 0;
    if (vehicle && massTonnes > capacityTonnes) {
      problems.push(
        `This Mission weighs ${massTonnes} tonnes, but its Launch Vehicle can only carry ${capacityTonnes} tonnes.`,
      );
    }

    const carriesLander = catalogue.assets.some(
      (asset) => assetIds.includes(asset.id) && asset.landsAtSite === true,
    );
    if (carriesLander) {
      if (landingSiteId === undefined) {
        problems.push(
          "A Mission carrying a lander must choose a Landing Site.",
        );
      } else if (
        !knownLandingSites().some((site) => site.id === landingSiteId)
      ) {
        problems.push(
          `There is no known Landing Site called "${landingSiteId}".`,
        );
      }
    } else if (landingSiteId !== undefined) {
      problems.push("Only a Mission carrying a lander has a Landing Site.");
    }

    const plannedEvents = missionEventsFor(launchVehicleId, assetIds);
    for (const [eventId, levelId] of Object.entries(reliability)) {
      if (!plannedEvents.some((event) => event.id === eventId)) {
        problems.push(`This Mission has no Mission Event called "${eventId}".`);
      }
      if (!catalogue.reliabilityLevels.some((level) => level.id === levelId)) {
        problems.push(`There is no Reliability level called "${levelId}".`);
      }
    }
    costMillions += sum(
      plannedEvents.map(
        (event) => reliabilityLevelFor(plan.mission, event.id).costMillions,
      ),
    );

    if (costMillions > program.moneyMillions) {
      problems.push(
        `This Mission costs ${formatMoney(costMillions)}, but the Program only has ${formatMoney(program.moneyMillions)}.`,
      );
    }
    return { costMillions, massTonnes, capacityTonnes, problems };
  }

  return {
    startProgram(seed) {
      const {
        firstLaunchWindow,
        startingMoneyMillions,
        startingPublicSupport,
      } = catalogue.program;
      return {
        seed,
        turnNumber: 1,
        date: firstLaunchWindow,
        moneyMillions: startingMoneyMillions,
        publicSupport: startingPublicSupport,
        science: 0,
        milestoneIds: [],
        landedSiteIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [],
        status: { kind: "active" },
      };
    },

    saveProgram,

    restoreProgram: (saved) => restoreProgram(saved, catalogue),

    readProgram(program) {
      const nextThreshold = catalogue.fundingThresholds.find(
        ({ publicSupport }) =>
          !program.fundingThresholdsPaid.includes(publicSupport),
      );
      return {
        status: program.status,
        nextFundingThreshold: nextThreshold
          ? {
              ...nextThreshold,
              pointsAway: nextThreshold.publicSupport - program.publicSupport,
            }
          : null,
        cancellationLevel: catalogue.program.cancellationLevel,
        turnNumber: program.turnNumber,
        date: program.date,
        moneyMillions: program.moneyMillions,
        publicSupport: program.publicSupport,
        science: program.science,
        milestones: catalogue.milestones
          .filter(({ id }) => program.milestoneIds.includes(id))
          .map(({ id, name }) => ({ id, name })),
        operatingAssets: program.operatingAssets.map((asset) => ({
          ...asset,
          landingSiteName: landingSiteById(asset.landingSiteId)?.name ?? null,
        })),
        landingSites: knownLandingSites().map(
          ({ id, name, description, science }) => ({
            id,
            name,
            description,
            science,
            landed: program.landedSiteIds.includes(id),
          }),
        ),
        launchVehicles: catalogue.launchVehicles.map(
          ({ id, name, costMillions, capacityTonnes }) => ({
            id,
            name,
            costMillions,
            capacityTonnes,
          }),
        ),
        assets: catalogue.assets.map(
          ({ id, name, kind, costMillions, massTonnes, landsAtSite }) => ({
            id,
            name,
            kind,
            costMillions,
            massTonnes,
            landsAtSite: landsAtSite === true,
          }),
        ),
      };
    },

    validatePlan: checkPlan,

    previewMission(_program, mission) {
      return missionEventsFor(mission.launchVehicleId, mission.assetIds).map(
        (event) => {
          const chosen = reliabilityLevelFor(mission, event.id);
          return {
            eventId: event.id,
            name: event.name,
            riskBand: riskBandFor(failureProbability(event, chosen, mission)),
            reliabilityLevelId: chosen.id,
            reliabilityLevels: catalogue.reliabilityLevels.map((level) => ({
              id: level.id,
              name: level.name,
              costMillions: level.costMillions,
              riskBand: riskBandFor(failureProbability(event, level, mission)),
            })),
          };
        },
      );
    },

    runTurn(program, plan) {
      const { costMillions, problems } = checkPlan(program, plan);
      if (problems.length > 0) throw new Error(problems.join(" "));

      return resolveTurn(catalogue, rules, program, plan, costMillions);
    },

    retireProgram(program) {
      if (program.status.kind !== "active") {
        throw new Error("This Program has ended.");
      }
      return { ...program, status: { kind: "retired" } };
    },
  };
}
