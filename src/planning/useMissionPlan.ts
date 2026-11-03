import { useState } from "react";
import {
  canFly,
  type AssetChoices,
  type PlannedAsset,
  type PlannedCrew,
  type PlannedTrajectory,
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";

/** The choices made so far for this Turn's Mission, what the Simulation previews of them, and the plans they make. */
interface MissionPlan {
  launchVehicleId: string;
  chooseLaunchVehicle: (launchVehicleId: string) => void;
  trajectories: PlannedTrajectory[];
  trajectory: PlannedTrajectory | undefined;
  chooseTrajectory: (trajectoryId: string) => void;
  assetIds: string[];
  setCarried: (assetId: string, carried: boolean) => void;
  plannedAssets: PlannedAsset[];
  changeAssetChoices: (assetId: string, choices: AssetChoices) => void;
  /** The Crew chosen, which only a Crewed Mission has. */
  plannedCrew: PlannedCrew | null;
  /** Makes it a Crewed Mission with this many Crew, or a Robotic Mission with null. */
  chooseCrewSize: (size: number | null) => void;
  chooseCrewActivity: (activityId: string) => void;
  /** The Landing Site chosen, which only a Mission carrying an Asset that lands has. */
  landingSite: ProgramView["landingSites"][number] | undefined;
  chooseLandingSite: (siteId: string) => void;
  plannedEvents: ReturnType<Simulation["previewMission"]>;
  chooseReliability: (eventId: string, levelId: string) => void;
  setContingencyBought: (contingencyId: string, bought: boolean) => void;
  /** The plan that launches the Mission. */
  plan: TurnPlan;
  check: ReturnType<Simulation["validatePlan"]>;
  /** The plan that ends the Turn without launching, which keeps the Activities and Developments chosen. */
  withoutLaunching: TurnPlan;
  withoutLaunchingProblems: string[];
}

/** Everything the player has chosen for this Turn's Mission in the New Mission panel, and the plan it makes. */
export function useMissionPlan(
  simulation: Simulation,
  program: Program,
  view: ProgramView,
  /** The new Activities chosen for Assets already operating, which either plan sends. */
  operatingActivities: Record<string, string>,
  /** The Developments chosen to start this Turn, which either plan sends. */
  developmentIds: string[],
  /** The new Activities chosen for Crew already operating, which either plan sends. */
  crewActivities: Record<string, string>,
): MissionPlan {
  // It starts on the first that can fly, because one that needs Development can't be chosen.
  const [launchVehicleId, setLaunchVehicleId] = useState(
    view.launchVehicles.find(canFly)?.id ?? "",
  );
  // None start ticked, so that one already at Mars never looks as if it has to be launched again.
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [reliability, setReliability] = useState<Record<string, string>>({});
  const [chosenSiteId, setChosenSiteId] = useState(
    view.landingSites[0]?.id ?? "",
  );
  const [assetChoices, setAssetChoices] = useState<
    Record<string, AssetChoices>
  >({});
  const [contingencyIds, setContingencyIds] = useState<string[]>([]);
  const [trajectoryId, setTrajectoryId] = useState<string | undefined>();
  // A Turn starts with a Robotic Mission, as it does with no Asset ticked.
  const [crewSize, setCrewSize] = useState<number | null>(null);
  const [crewActivityId, setCrewActivityId] = useState<string | undefined>();

  const landsOnMars = view.assets.some(
    (asset) => assetIds.includes(asset.id) && asset.landsAtSite,
  );
  const landingSite = landsOnMars
    ? view.landingSites.find((site) => site.id === chosenSiteId)
    : undefined;
  const carried = {
    launchVehicleId,
    assetIds,
    ...(crewSize !== null && {
      crew: {
        size: crewSize,
        ...(crewActivityId !== undefined && { activityId: crewActivityId }),
      },
    }),
  };
  const mission = {
    ...carried,
    ...(landingSite && { landingSiteId: landingSite.id }),
    // A choice can outlive a change of Asset that takes it off the list.
    ...(trajectoryId !== undefined &&
      simulation
        .previewTrajectories(carried)
        .some(({ id }) => id === trajectoryId) && { trajectoryId }),
  };
  const plannedCrew = simulation.previewCrew(program, mission);
  const trajectories = simulation.previewTrajectories(mission);
  const plannedEvents = simulation.previewMission(program, {
    ...mission,
    reliability,
    contingencyIds,
  });
  const plannedAssets = simulation.previewAssets(program, {
    ...mission,
    assetChoices,
  });
  const plan: TurnPlan = {
    operatingActivities,
    developmentIds,
    crewActivities,
    mission: {
      ...mission,
      // The Activity they will have, which may be that of Crew already there.
      ...(plannedCrew && {
        crew: { size: plannedCrew.size, activityId: plannedCrew.activityId },
      }),
      // Only the Mission Events this Mission goes through, because a choice can outlive a change of Asset.
      reliability: Object.fromEntries(
        plannedEvents.map((event) => [event.eventId, event.reliabilityLevelId]),
      ),
      // Only those for the Mission Events it goes through, for the same reason.
      contingencyIds: plannedEvents.flatMap(({ contingency }) =>
        contingency?.bought ? [contingency.id] : [],
      ),
      // Only the Assets this Mission carries, for the same reason.
      assetChoices: Object.fromEntries(
        plannedAssets.map((asset) => [
          asset.assetId,
          {
            serviceLifeDays: asset.serviceLifeDays,
            reliabilityLevelId: asset.reliabilityLevelId,
            activityId: asset.activityId,
          },
        ]),
      ),
    },
  };
  const withoutLaunching: TurnPlan = {
    mission: null,
    operatingActivities,
    developmentIds,
    crewActivities,
  };

  return {
    launchVehicleId,
    chooseLaunchVehicle: setLaunchVehicleId,
    trajectories,
    trajectory: trajectories.find(({ chosen }) => chosen),
    chooseTrajectory: setTrajectoryId,
    assetIds,
    setCarried: (assetId, carried) => {
      setAssetIds(
        carried
          ? [...assetIds, assetId]
          : assetIds.filter((id) => id !== assetId),
      );
    },
    plannedAssets,
    changeAssetChoices: (assetId, choices) => {
      setAssetChoices({
        ...assetChoices,
        [assetId]: { ...assetChoices[assetId], ...choices },
      });
    },
    plannedCrew,
    chooseCrewSize: setCrewSize,
    chooseCrewActivity: setCrewActivityId,
    landingSite,
    chooseLandingSite: setChosenSiteId,
    plannedEvents,
    chooseReliability: (eventId, levelId) => {
      setReliability({ ...reliability, [eventId]: levelId });
    },
    setContingencyBought: (contingencyId, bought) => {
      setContingencyIds(
        bought
          ? [...contingencyIds, contingencyId]
          : contingencyIds.filter((other) => other !== contingencyId),
      );
    },
    plan,
    check: simulation.validatePlan(program, plan),
    withoutLaunching,
    withoutLaunchingProblems: simulation.validatePlan(program, withoutLaunching)
      .problems,
  };
}
