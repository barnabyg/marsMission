import type { Catalogue } from "../catalogue/catalogue";
import { formatMoney, operatingKey, sum, type Rules } from "./rules";
import { costOf, readinessOf, type Technology } from "./technologyReadiness";
import { checkCrew, operatingCrewProblems } from "./crew";
import { developmentsStarting } from "./development";
import type { PlanCheck } from "./previews";
import type { PlannedMission, Program, TurnPlan } from "./types";

const noMission = { costMillions: 0, massTonnes: 0, capacityTonnes: 0 };

/** Works out what a plan costs and weighs, and what's wrong with it, if anything. */
export function createPlanCheck(catalogue: Catalogue, rules: Rules) {
  const {
    activityById,
    assetReliabilityFor,
    knownLandingSites,
    missionEventsFor,
    reliabilityLevelFor,
    serviceLifeFor,
    trajectoryFor,
    trajectoryOffered,
  } = rules;

  /** What's wrong with giving this Activity to an Asset that lists `activityIds`, if anything. */
  function activityProblems(
    assetName: string,
    activityIds: string[],
    activityId: string,
  ): string[] {
    const activity = activityById(activityId);
    if (!activity) return [`There is no Activity called "${activityId}".`];
    return activityIds.includes(activityId)
      ? []
      : [`${assetName} can't do the Activity "${activity.name}".`];
  }

  /** What's wrong with flying a technology, which is nothing once it is built. */
  function notBuiltProblems(
    program: Program,
    technology: Technology,
  ): string[] {
    return readinessOf(program, technology) === "not-built"
      ? [`${technology.name} can't fly until it has been through Development.`]
      : [];
  }

  function operatingActivityProblems(
    program: Program,
    plan: TurnPlan,
  ): string[] {
    return Object.entries(plan.operatingActivities ?? {}).flatMap(
      ([key, activityId]) => {
        const asset = program.operatingAssets.find(
          (candidate) => operatingKey(candidate) === key,
        );
        if (!asset) return [`There is no operating Asset called "${key}".`];
        const design = catalogue.assets.find(({ id }) => id === asset.assetId);
        return activityProblems(
          asset.name,
          design?.activities ?? [],
          activityId,
        );
      },
    );
  }

  function checkPlan(program: Program, plan: TurnPlan): PlanCheck {
    if (program.status.kind !== "active") {
      return {
        ...noMission,
        developmentCostMillions: 0,
        problems: ["This Program has ended."],
      };
    }
    const mission = plan.mission
      ? checkMission(program, plan.mission)
      : { ...noMission, problems: [] };
    const developments = developmentsStarting(
      catalogue,
      program,
      plan.developmentIds ?? [],
    );
    const problems = [
      ...operatingActivityProblems(program, plan),
      ...operatingCrewProblems(catalogue, rules, program, plan),
      ...mission.problems,
      ...developments.problems,
    ];
    const totalMillions = mission.costMillions + developments.costMillions;
    if (totalMillions > program.moneyMillions) {
      const paying = !plan.mission
        ? developments.technologies.length > 1
          ? "These Developments cost"
          : "This Development costs"
        : developments.technologies.length === 0
          ? "This Mission costs"
          : developments.technologies.length > 1
            ? "This Mission and these Developments cost"
            : "This Mission and Development cost";
      problems.push(
        `${paying} ${formatMoney(totalMillions)}, but the Program only has ${formatMoney(program.moneyMillions)}.`,
      );
    }
    return {
      ...mission,
      developmentCostMillions: developments.costMillions,
      problems,
    };
  }

  /** What a Mission costs and weighs, and what's wrong with it apart from what the whole plan costs. */
  function checkMission(
    program: Program,
    planned: PlannedMission,
  ): Omit<PlanCheck, "developmentCostMillions"> {
    const {
      launchVehicleId,
      assetIds,
      reliability = {},
      landingSiteId,
      assetChoices = {},
      contingencyIds = [],
      trajectoryId,
    } = planned;
    const problems: string[] = [];
    let costMillions = 0;
    let massTonnes = 0;

    const vehicle = catalogue.launchVehicles.find(
      (candidate) => candidate.id === launchVehicleId,
    );
    if (vehicle) {
      costMillions += costOf(program, vehicle);
      problems.push(...notBuiltProblems(program, vehicle));
    } else
      problems.push(`There is no Launch Vehicle called "${launchVehicleId}".`);

    if (assetIds.length === 0 && !planned.crew) {
      problems.push("A Mission must carry at least one Asset or Crew.");
    }
    if (new Set(assetIds).size < assetIds.length) {
      problems.push("A Mission can't carry the same Asset twice.");
    }
    for (const assetId of assetIds) {
      const asset = catalogue.assets.find(
        (candidate) => candidate.id === assetId,
      );
      if (asset) {
        costMillions += costOf(program, asset);
        massTonnes += asset.massTonnes;
        problems.push(...notBuiltProblems(program, asset));
      } else problems.push(`There is no Asset called "${assetId}".`);
    }
    const crew = checkCrew(catalogue, rules, program, planned);
    costMillions += crew.costMillions;
    massTonnes += crew.massTonnes;
    problems.push(...crew.problems);
    const plannedEvents = missionEventsFor(planned);
    if (new Set(contingencyIds).size < contingencyIds.length) {
      problems.push("A Mission can't buy the same Contingency twice.");
    }
    for (const contingencyId of contingencyIds) {
      const contingency = catalogue.contingencies.find(
        ({ id }) => id === contingencyId,
      );
      if (!contingency) {
        problems.push(`There is no Contingency called "${contingencyId}".`);
      } else {
        costMillions += contingency.costMillions;
        massTonnes += contingency.massTonnes;
        if (!plannedEvents.some(({ id }) => id === contingency.missionEvent)) {
          problems.push(
            `This Mission doesn't go through the Mission Event that ${contingency.name} is for.`,
          );
        }
      }
    }
    // Masses like 0.1 and 0.2 don't add up exactly, and a Mission at exactly its capacity must fit.
    massTonnes = Math.round(massTonnes * 1000) / 1000;
    if (
      trajectoryId !== undefined &&
      !catalogue.trajectories.some(({ id }) => id === trajectoryId)
    ) {
      problems.push(`There is no Trajectory called "${trajectoryId}".`);
    }
    const trajectory = trajectoryFor(planned);
    if (!trajectoryOffered(trajectory, planned)) {
      const burn = catalogue.missionEvents.find(
        ({ id }) => id === trajectory.freeReturn?.arrivalBurn,
      );
      problems.push(
        `${trajectory.name} is only for a Mission that goes through ${burn?.name ?? "its arrival burn"}.`,
      );
    }
    costMillions += trajectory.costMillions;
    const capacityTonnes = vehicle
      ? Math.round(
          (vehicle.capacityTonnes - trajectory.capacityLossTonnes) * 1000,
        ) / 1000
      : 0;
    if (vehicle && massTonnes > capacityTonnes) {
      problems.push(
        `This Mission weighs ${massTonnes} tonnes, but its Launch Vehicle can only carry ${capacityTonnes} tonnes.`,
      );
    }

    const landsOnMars = catalogue.assets.some(
      (asset) => assetIds.includes(asset.id) && asset.landsAtSite === true,
    );
    if (landsOnMars) {
      if (landingSiteId === undefined) {
        problems.push(
          "A Mission that lands on Mars must choose a Landing Site.",
        );
      } else if (
        !knownLandingSites(program).some((site) => site.id === landingSiteId)
      ) {
        problems.push(
          `There is no known Landing Site called "${landingSiteId}".`,
        );
      }
    } else if (landingSiteId !== undefined) {
      problems.push("Only a Mission that lands on Mars has a Landing Site.");
    }

    for (const [assetId, choices] of Object.entries(assetChoices)) {
      if (!assetIds.includes(assetId)) {
        problems.push(
          `This Mission isn't carrying an Asset called "${assetId}".`,
        );
        continue;
      }
      const asset = catalogue.assets.find(({ id }) => id === assetId);
      const { serviceLifeDays, reliabilityLevelId, activityId } = choices;
      if (asset && activityId !== undefined) {
        problems.push(
          ...activityProblems(asset.name, asset.activities, activityId),
        );
      }
      if (
        reliabilityLevelId !== undefined &&
        !catalogue.reliabilityLevels.some(({ id }) => id === reliabilityLevelId)
      ) {
        problems.push(
          `There is no Reliability level called "${reliabilityLevelId}".`,
        );
      }
      if (
        asset &&
        serviceLifeDays !== undefined &&
        !asset.serviceLifeOptions.some(({ days }) => days === serviceLifeDays)
      ) {
        problems.push(
          `${asset.name} has no Service Life of ${serviceLifeDays} days.`,
        );
      }
    }
    for (const asset of catalogue.assets) {
      if (assetIds.includes(asset.id)) {
        costMillions += serviceLifeFor(planned, asset).costMillions;
        costMillions += assetReliabilityFor(planned, asset).costMillions;
      }
    }

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
        (event) => reliabilityLevelFor(planned, event.id).costMillions,
      ),
    );

    return { costMillions, massTonnes, capacityTonnes, problems };
  }

  return checkPlan;
}
