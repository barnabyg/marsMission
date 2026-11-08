import type { Catalogue } from "../catalogue/catalogue";
import { largestRaise, type Raise } from "./benefits";
import { previewCrew, type PlannedCrew } from "./crewView";
import { earningsPerTurn, grantOverDays } from "./ongoingResearch";
import { cachesPerTurn } from "./sampleCaching";
import {
  daysUntilServiceEnds,
  type Activity,
  type Asset,
  type Rules,
} from "./rules";
import { isFlightProven } from "./technologyReadiness";
import type {
  PlannedActivity,
  PlannedAsset,
  PlannedMissionEvent,
  PlannedServiceLife,
  PlannedTrajectory,
} from "./previews";
import type { PlannedMission, Program } from "./types";

/** An Activity as Planning Mode offers it, raised for an Asset that a Benefit raises. */
export const plannedActivity =
  (catalogue: Catalogue, raise: Raise | null) =>
  (activity: Activity): PlannedActivity => {
    const earnsPerTurn = earningsPerTurn(catalogue, activity, raise?.percent);
    return {
      id: activity.id,
      name: activity.name,
      description: activity.description,
      surveys: activity.effect.kind === "survey",
      earnsPerTurn,
      cachesPerTurn: cachesPerTurn(catalogue, activity),
      ...(raise && earnsPerTurn ? { raisedBy: raise } : {}),
    };
  };

/**
 * The Service Lives on offer for an Asset delivered on this day of the Turn, each with the days it adds beyond the
 * shortest, in Turns too, the Research Grants this Activity would pay over them, raised by this percentage, and the
 * Upkeep of the Turns it would be kept going for as they start.
 */
function plannedServiceLives(
  catalogue: Catalogue,
  asset: Asset,
  activity: Activity,
  deliveredOn: number,
  percent: number,
): PlannedServiceLife[] {
  const turnDays = catalogue.program.launchWindowIntervalDays;
  // Upkeep is paid as each later Turn starts while some Service Life is left.
  const upkeepTurns = (days: number) =>
    Math.max(0, Math.ceil((deliveredOn + days) / turnDays) - 1);
  const shortest = Math.min(
    ...asset.serviceLifeOptions.map(({ days }) => days),
  );
  return asset.serviceLifeOptions.map(({ days, costMillions }) => {
    const extraDays = days - shortest;
    return {
      days,
      costMillions,
      extraDays,
      extraTurns: Math.round((10 * extraDays) / turnDays) / 10,
      extraGrantMillions:
        extraDays > 0
          ? grantOverDays(catalogue, activity, extraDays, percent)
          : 0,
      extraUpkeepMillions:
        (upkeepTurns(days) - upkeepTurns(shortest)) *
        (asset.upkeepMillionsPerTurn ?? 0),
    };
  });
}

/** What raises surface research with these Assets at Mars, if it is raised, going by the ones operating as the Turn starts. */
export function surfaceRaise(
  catalogue: Catalogue,
  program: Program,
  arriving: { assetId: string; name: string }[] = [],
): Raise | null {
  return largestRaise(
    catalogue,
    [
      ...program.operatingAssets.filter(
        (asset) => daysUntilServiceEnds(program.date, asset) > 0,
      ),
      ...arriving,
    ],
    "surfaceResearch",
  );
}

/** What Planning Mode shows of a Mission before it launches: its Mission Events, Assets, Trajectories and Crew. */
export function createMissionPreviews(catalogue: Catalogue, rules: Rules) {
  const {
    activitiesOf,
    activityFor,
    assetReliabilityFor,
    failureProbability,
    homewardEventsFor,
    inServiceFailureChance,
    missionEventsFor,
    reliabilityLevelFor,
    riskBandFor,
    serviceLifeFor,
  } = rules;

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

  return {
    previewMission(
      program: Program,
      mission: PlannedMission,
    ): PlannedMissionEvent[] {
      const homeward = new Set(homewardEventsFor(mission));
      // A round trip's journey home comes after the way there, on a later Turn.
      return [...missionEventsFor(mission), ...homewardEventsFor(mission)].map(
        (event) => {
          const chosen = reliabilityLevelFor(mission, event.id);
          return {
            eventId: event.id,
            name: event.name,
            homeward: homeward.has(event),
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
        },
      );
    },

    previewAssets(program: Program, mission: PlannedMission): PlannedAsset[] {
      const carried = catalogue.assets.filter((asset) =>
        mission.assetIds.includes(asset.id),
      );
      const raised = surfaceRaise(
        catalogue,
        program,
        carried.map(({ id, name }) => ({ assetId: id, name })),
      );
      return carried.map((asset) => {
        const unproven = !isFlightProven(program, asset);
        const raise = asset.landsAtSite === true ? raised : null;
        return {
          assetId: asset.id,
          name: asset.name,
          serviceLifeDays: serviceLifeFor(mission, asset).days,
          serviceLifeOptions: plannedServiceLives(
            catalogue,
            asset,
            activityFor(mission, asset),
            rules.deliveryDay(asset, mission),
            raise?.percent ?? 0,
          ),
          reliabilityLevelId: assetReliabilityFor(mission, asset).id,
          activityId: activityFor(mission, asset).id,
          activities: activitiesOf(asset).map(
            plannedActivity(catalogue, raise),
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

    previewTrajectories(mission: PlannedMission): PlannedTrajectory[] {
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

    previewCrew: (
      program: Program,
      mission: PlannedMission,
    ): PlannedCrew | null =>
      previewCrew(
        catalogue,
        rules,
        program,
        mission,
        // An Asset on the same Mission that raises research on the surface raises the Crew's too.
        surfaceRaise(
          catalogue,
          program,
          catalogue.assets
            .filter(({ id }) => mission.assetIds.includes(id))
            .map(({ id, name }) => ({ assetId: id, name })),
        ),
      ),
  };
}
