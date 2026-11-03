import {
  canFly,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";
import type { PlanningTools } from "./playStyle";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/**
 * Crewed Missions to Mars orbit with no Asset aboard, largest Crew first, each on the cheapest Launch Vehicle that is
 * built and can carry it, with the Activity that earns the most Science. None if no Launch Vehicle can carry Crew.
 */
export function crewedMissions(
  view: ProgramView,
  tools: PlanningTools,
): PlannedMission[] {
  return view.crewedMission.sizes
    .toSorted((first, second) => second.crew - first.crew)
    .flatMap(({ crew, massTonnes }) => {
      const vehicle = view.launchVehicles
        .filter(
          (candidate) =>
            canFly(candidate) && candidate.capacityTonnes >= massTonnes,
        )
        .toSorted(
          (first, second) => first.costMillions - second.costMillions,
        )[0];
      if (!vehicle) return [];
      const mission = {
        launchVehicleId: vehicle.id,
        assetIds: [],
        crew: { size: crew },
      };
      const planned = tools.previewCrew(mission);
      if (!planned) return [];
      const best = planned.activities.toSorted(
        (first, second) =>
          (second.earnsPerTurn?.science ?? 0) -
          (first.earnsPerTurn?.science ?? 0),
      )[0];
      return [
        {
          ...mission,
          crew: { size: crew, activityId: best?.id ?? planned.activityId },
        },
      ];
    });
}
