import {
  canFly,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";
import type { PlanningTools } from "./playStyle";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/**
 * Where Crew who land go: a surveyed Landing Site, as Crew are worth more than any Asset, one not yet landed at before
 * one that has been, then the most Science. None until a Survey has made a site safer.
 */
function crewLandingSite(view: ProgramView): string | undefined {
  return view.landingSites
    .filter(({ surveyed }) => surveyed)
    .toSorted(
      (first, second) =>
        Number(first.landed) - Number(second.landed) ||
        second.science - first.science,
    )[0]?.id;
}

/**
 * Crewed Missions with no Asset aboard, largest Crew first and then the most Supplies, each on the cheapest Launch
 * Vehicle that is built and can carry it, with the Activity that earns the most Science. They go to Mars orbit, or land
 * at a surveyed Landing Site if `lands` and there is one. None if no Launch Vehicle can carry Crew.
 */
export function crewedMissions(
  view: ProgramView,
  tools: PlanningTools,
  lands = false,
): PlannedMission[] {
  const landingSiteId = lands ? crewLandingSite(view) : undefined;
  const supplies = view.crewedMission.supplies.toReversed();
  return view.crewedMission.sizes
    .toSorted((first, second) => second.crew - first.crew)
    .flatMap((size) => supplies.map((carried) => ({ size, carried })))
    .flatMap(({ size: { crew, massTonnes }, carried }) => {
      const vehicle = view.launchVehicles
        .filter(
          (candidate) =>
            canFly(candidate) &&
            candidate.capacityTonnes >= massTonnes + carried.massTonnes,
        )
        .toSorted(
          (first, second) => first.costMillions - second.costMillions,
        )[0];
      if (!vehicle) return [];
      const mission = {
        launchVehicleId: vehicle.id,
        assetIds: [],
        crew: {
          size: crew,
          landsAtSite: landingSiteId !== undefined,
          suppliesId: carried.id,
        },
        ...(landingSiteId === undefined ? {} : { landingSiteId }),
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
          crew: {
            ...mission.crew,
            activityId: best?.id ?? planned.activityId,
          },
        },
      ];
    });
}
