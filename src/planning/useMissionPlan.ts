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
export interface MissionPlan {
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
  /** Whether the Crew land at the Landing Site, rather than staying in Mars orbit. */
  crewLands: boolean;
  chooseCrewLands: (lands: boolean) => void;
  /** Chooses the Supplies the Crew carry, by id. */
  chooseCrewSupplies: (suppliesId: string) => void;
  /** Chooses the Protection the Crewed Mission carries, by id. */
  chooseCrewProtection: (protectionId: string) => void;
  /** Whether the Mission carries an Asset or Crew that land at a Landing Site. */
  landsOnMars: boolean;
  /** The Landing Site chosen, which only a Mission carrying an Asset or Crew that land has. */
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
  /** Whether no Asset or Crew is ticked, so the Turn can only end without launching. */
  nothingTicked: boolean;
  /** What the Turn will spend: the Mission, Developments and Upkeep, or only the Developments and Upkeep with nothing ticked. */
  spendMillions: number;
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
  /** The Assets at Mars whose missions end as the Turn starts, which either plan sends. */
  endedAssetKeys: string[],
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
  const [crewLands, setCrewLands] = useState(false);
  const [crewSuppliesId, setCrewSuppliesId] = useState<string | undefined>();
  const [crewProtectionId, setCrewProtectionId] = useState<
    string | undefined
  >();

  const landsOnMars =
    (crewSize !== null && crewLands) ||
    view.assets.some(
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
        ...(crewLands && { landsAtSite: true }),
        ...(crewSuppliesId !== undefined && { suppliesId: crewSuppliesId }),
        ...(crewProtectionId !== undefined && {
          protectionId: crewProtectionId,
        }),
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
    endedAssetKeys,
    mission: {
      ...mission,
      // The Activity they will have, which may be that of Crew already there.
      ...(plannedCrew && {
        crew: {
          size: plannedCrew.size,
          activityId: plannedCrew.activityId,
          ...(crewLands && { landsAtSite: true }),
          suppliesId: plannedCrew.suppliesId,
          protectionId: plannedCrew.protectionId,
        },
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
    endedAssetKeys,
  };

  const check = simulation.validatePlan(program, plan);
  const nothingTicked = assetIds.length === 0 && plannedCrew === null;

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
    crewLands,
    chooseCrewLands: (lands) => {
      setCrewLands(lands);
      // Crew in orbit and Crew on the surface do different Activities.
      setCrewActivityId(undefined);
    },
    chooseCrewSupplies: setCrewSuppliesId,
    chooseCrewProtection: setCrewProtectionId,
    landsOnMars,
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
    check,
    withoutLaunching,
    withoutLaunchingProblems: simulation.validatePlan(program, withoutLaunching)
      .problems,
    nothingTicked,
    spendMillions:
      check.developmentCostMillions +
      check.upkeepMillions +
      (nothingTicked ? 0 : check.costMillions),
  };
}
