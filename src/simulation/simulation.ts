import type { Catalogue } from "../catalogue/catalogue";
import {
  createRules,
  daysUntilServiceEnds,
  operatingKey,
  type Activity,
} from "./rules";
import { describeBenefit, largestRaise, type Raise } from "./benefits";
import { needingDevelopment, plannedDevelopment } from "./development";
import { flyMission } from "./flyMission";
import { missionOnTimeline, timelineUpToDecision } from "./missionReport";
import { earningsPerTurn } from "./ongoingResearch";
import { createPlanCheck } from "./planCheck";
import { restoreProgram, saveProgram, type SavedProgram } from "./saveFormat";
import { costOf, isFlightProven, readinessOf } from "./technologyReadiness";
import { resolveTurn } from "./turnSteps";
import type {
  PlanCheck,
  PlannedActivity,
  PlannedAsset,
  PlannedMissionEvent,
  PlannedTrajectory,
} from "./previews";
import type {
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  PlannedMission,
  Program,
  ProgramView,
  TurnPlan,
  TurnProgress,
  TurnResult,
} from "./types";

export { addDays, formatMoney } from "./rules";
export { corruptSave, SaveError } from "./saveFormat";
export {
  canFly,
  everyTechnology,
  technologiesOn,
  type TechnologyReadiness,
} from "./technologyReadiness";
export type {
  AssetChoices,
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  Program,
  ProgramView,
  TurnPlan,
  TurnProgress,
  TurnResult,
} from "./types";
export type {
  PlannedActivity,
  PlannedAsset,
  PlannedDevelopment,
  PlannedTrajectory,
} from "./previews";
export type { TurnSummary } from "./turnSummary";
export type { AssetAtMars, Timeline, TimelineEntry } from "./timeline";

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
  /** The choices a Mission can make for each Asset it carries. Ids that aren't in the catalogue are skipped. */
  previewAssets(program: Program, mission: PlannedMission): PlannedAsset[];
  /** The Trajectories on offer to a Mission, in the order the Catalogue lists them. */
  previewTrajectories(mission: PlannedMission): PlannedTrajectory[];
  /** Works out a Turn from the seed, the plan and the answers so far, stopping at the first Decision Point with no answer. */
  workOutTurn(
    program: Program,
    plan: TurnPlan,
    answers?: DecisionAnswers,
  ): TurnProgress;
  /** The whole of a Turn that has an answer for every Decision Point it meets. Throws if it hasn't. */
  runTurn(
    program: Program,
    plan: TurnPlan,
    answers?: DecisionAnswers,
  ): TurnResult;
  retireProgram(program: Program): Program;
}

/** The answer that plays a Turn on with nothing rolled for it, for what comes before a Decision Point. */
function cautiousAnswer({ kind }: DecisionPoint): DecisionAnswer {
  const cautious: Record<DecisionPoint["kind"], DecisionAnswer> = {
    contingency: "decline",
    dustStorm: "shelter",
    solarParticleEvent: "safeMode",
    goNoGo: "holdOff",
  };
  return cautious[kind];
}

export function createSimulation(catalogue: Catalogue): Simulation {
  const rules = createRules(catalogue);
  const {
    activitiesOf,
    activityFor,
    activityNameOf,
    failureProbability,
    assetReliabilityFor,
    inServiceFailureChance,
    knownLandingSites,
    serviceLifeFor,
    landingRisk,
    landingSiteById,
    missionEventsFor,
    reliabilityLevelFor,
    riskBandFor,
  } = rules;

  /** An Activity as Planning Mode offers it, raised for an Asset that a Benefit raises. */
  const plannedActivity =
    (raise: Raise | null) =>
    (activity: Activity): PlannedActivity => {
      const earnsPerTurn = earningsPerTurn(catalogue, activity, raise?.percent);
      return {
        id: activity.id,
        name: activity.name,
        description: activity.description,
        surveys: activity.effect.kind === "survey",
        earnsPerTurn,
        ...(raise && earnsPerTurn ? { raisedBy: raise } : {}),
      };
    };

  /** What raises surface research with these Assets at Mars, if it is raised, going by the ones operating as the Turn starts. */
  const surfaceRaise = (
    program: Program,
    arriving: { assetId: string; name: string }[] = [],
  ) =>
    largestRaise(
      catalogue,
      [
        ...program.operatingAssets.filter(
          (asset) => daysUntilServiceEnds(program.date, asset) > 0,
        ),
        ...arriving,
      ],
      "surfaceResearch",
    );

  const checkPlan = createPlanCheck(catalogue, rules);

  function contingencyOffered(
    eventId: string,
    mission: PlannedMission,
  ): PlannedMissionEvent["contingency"] {
    const offered = catalogue.contingencies.find(
      ({ missionEvent }) => missionEvent === eventId,
    );
    return offered
      ? {
          id: offered.id,
          name: offered.name,
          description: offered.description,
          costMillions: offered.costMillions,
          massTonnes: offered.massTonnes,
          riskBand: riskBandFor(offered.rescueFailureProbability),
          bought: mission.contingencyIds?.includes(offered.id) === true,
        }
      : null;
  }

  function workOutTurn(
    program: Program,
    plan: TurnPlan,
    answers: DecisionAnswers = {},
  ): TurnProgress {
    const { costMillions, problems } = checkPlan(program, plan);
    if (problems.length > 0) throw new Error(problems.join(" "));

    const fly = (given: DecisionAnswers) =>
      flyMission(catalogue, rules, program, plan, given);
    const flown = fly(answers);
    const missionDecision = flown.decisionPoint;
    // The Mission never depends on the rest of the Turn, but what's at stake on a day depends on the Mission so far.
    const asIfCautious = missionDecision
      ? fly({
          ...answers,
          [missionDecision.id]: cautiousAnswer(missionDecision),
        })
      : flown;
    const { result, otherEntries, stormDecision } = resolveTurn(
      catalogue,
      rules,
      program,
      plan,
      costMillions,
      asIfCautious,
      answers,
    );
    const stormComesFirst =
      stormDecision !== null &&
      (missionDecision === null ||
        stormDecision.decisionPoint.day < missionDecision.day);
    const decisionPoint = stormComesFirst
      ? stormDecision.decisionPoint
      : missionDecision;
    if (!decisionPoint) {
      return { decisionPoint, timeline: result.timeline, result };
    }
    return {
      decisionPoint,
      timeline: timelineUpToDecision(
        result.timeline,
        otherEntries,
        flown.entries,
        missionOnTimeline(rules, plan, flown),
        {
          day: decisionPoint.day,
          entry: stormComesFirst ? stormDecision.entry : null,
        },
      ),
    };
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
        knownLandingSiteIds: catalogue.landingSites
          .filter((site) => site.knownFromStart)
          .map((site) => site.id),
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [],
        status: { kind: "active" },
      };
    },

    saveProgram,

    restoreProgram: (saved) => restoreProgram(saved, catalogue),

    readProgram(program) {
      const raised = surfaceRaise(program);
      const nextThreshold = catalogue.fundingThresholds.find(
        ({ publicSupport }) =>
          !program.fundingThresholdsPaid.includes(publicSupport),
      );
      return {
        status: program.status,
        nextFundingThreshold: nextThreshold
          ? {
              ...nextThreshold,
              // A save can already be above a level that pays when its next Turn runs.
              pointsAway: Math.max(
                0,
                nextThreshold.publicSupport - program.publicSupport,
              ),
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
          key: operatingKey(asset),
          activityName: activityNameOf(asset),
          activities: catalogue.assets
            .filter(({ id }) => id === asset.assetId)
            .flatMap(activitiesOf)
            .map(plannedActivity(asset.landingSiteId === null ? null : raised)),
          daysLeft: Math.max(0, daysUntilServiceEnds(program.date, asset)),
          landingSiteName: landingSiteById(asset.landingSiteId)?.name ?? null,
        })),
        developments: needingDevelopment(catalogue).map((technology) =>
          plannedDevelopment(program, technology),
        ),
        somethingLeftToSurvey: catalogue.landingSites.some(
          ({ id }) => !program.surveyedLandingSiteIds.includes(id),
        ),
        landingSites: knownLandingSites(program).map((site) => ({
          id: site.id,
          name: site.name,
          description: site.description,
          science: site.science,
          surveyed: program.surveyedLandingSiteIds.includes(site.id),
          riskBand: riskBandFor(landingRisk(program, site)),
          landed: program.landedSiteIds.includes(site.id),
        })),
        launchVehicles: catalogue.launchVehicles.map((vehicle) => ({
          id: vehicle.id,
          name: vehicle.name,
          costMillions: costOf(program, vehicle),
          capacityTonnes: vehicle.capacityTonnes,
          technologyReadiness: readinessOf(program, vehicle),
        })),
        assets: catalogue.assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          costMillions: costOf(program, asset),
          massTonnes: asset.massTonnes,
          landsAtSite: asset.landsAtSite === true,
          technologyReadiness: readinessOf(program, asset),
          benefit: asset.benefit ? describeBenefit(asset.benefit) : null,
        })),
      };
    },

    validatePlan: checkPlan,

    previewMission(program, mission) {
      return missionEventsFor(mission).map((event) => {
        const chosen = reliabilityLevelFor(mission, event.id);
        return {
          eventId: event.id,
          name: event.name,
          riskBand: riskBandFor(
            failureProbability(event, chosen, program, mission),
          ),
          reliabilityLevelId: chosen.id,
          reliabilityLevels: catalogue.reliabilityLevels.map((level) => ({
            id: level.id,
            name: level.name,
            costMillions: level.costMillions,
            riskBand: riskBandFor(
              failureProbability(event, level, program, mission),
            ),
          })),
          contingency: contingencyOffered(event.id, mission),
        };
      });
    },

    previewAssets(program, mission) {
      const carried = catalogue.assets.filter((asset) =>
        mission.assetIds.includes(asset.id),
      );
      const raised = surfaceRaise(
        program,
        carried.map(({ id, name }) => ({ assetId: id, name })),
      );
      return carried.map((asset) => {
        const unproven = !isFlightProven(program, asset);
        return {
          assetId: asset.id,
          name: asset.name,
          serviceLifeDays: serviceLifeFor(mission, asset).days,
          serviceLifeOptions: asset.serviceLifeOptions,
          reliabilityLevelId: assetReliabilityFor(mission, asset).id,
          activityId: activityFor(mission, asset).id,
          activities: activitiesOf(asset).map(
            plannedActivity(asset.landsAtSite === true ? raised : null),
          ),
          riskBand: riskBandFor(
            inServiceFailureChance(
              asset,
              assetReliabilityFor(mission, asset),
              unproven,
            ),
          ),
          reliabilityLevels: catalogue.reliabilityLevels.map((level) => ({
            id: level.id,
            name: level.name,
            costMillions: level.costMillions,
            riskBand: riskBandFor(
              inServiceFailureChance(asset, level, unproven),
            ),
          })),
        };
      });
    },

    previewTrajectories(mission) {
      const chosen = rules.trajectoryFor(mission);
      const offered = catalogue.trajectories.filter((trajectory) =>
        rules.trajectoryOffered(trajectory, mission),
      );
      return offered.map((trajectory) => ({
        id: trajectory.id,
        name: trajectory.name,
        description: trajectory.description,
        transferDays: trajectory.transferDays,
        costMillions: trajectory.costMillions,
        capacityLossTonnes: trajectory.capacityLossTonnes,
        chosen: trajectory === chosen,
      }));
    },

    workOutTurn,

    runTurn(program, plan, answers) {
      const progress = workOutTurn(program, plan, answers);
      if (progress.decisionPoint) {
        throw new Error(
          `This Turn stops at a Decision Point with no answer: ${progress.decisionPoint.id}.`,
        );
      }
      return progress.result;
    },

    retireProgram(program) {
      if (program.status.kind !== "active") {
        throw new Error("This Program has ended.");
      }
      return { ...program, status: { kind: "retired" } };
    },
  };
}
