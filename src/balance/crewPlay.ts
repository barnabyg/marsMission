import {
  canFly,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";
import type { PlanningTools } from "./strategy";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/** How a strategy flies Crew, which unless it says otherwise is to Mars orbit with the most Supplies and Protection that fit. */
export interface CrewStyle {
  /** Lands them at a surveyed Landing Site, once there is one, rather than keeping them in Mars orbit. */
  lands?: boolean;
  /** Carries the least Supplies. */
  leastSupplies?: boolean;
  /** Carries no Protection. */
  noProtection?: boolean;
  /** Buys the best Reliability on every Mission Event that it can afford, before giving up any Supplies or Protection. */
  reliability?: boolean;
  /** What it does at a solar particle event with Crew aboard, which is as at any other unless it says otherwise. */
  solarParticleEvents?: "safeMode" | "carryOn";
  /**
   * Sends them to Mars orbit on a round trip, with the Earth return stage and the most Protection that fits before the
   * largest Crew, and brings them home on the first Turn it can, rather than leaving them there. A round trip doesn't
   * land.
   */
  roundTrip?: boolean;
  /**
   * Lands them beside a habitat: at a surveyed Landing Site where one operates, if there is one, and otherwise with a
   * habitat aboard their Mission whenever it fits and can be afforded.
   */
  habitat?: boolean;
}

/** Whether a habitat with Service Life left operates at this Landing Site. */
const habitatAt = (view: ProgramView, siteId: string) =>
  view.operatingAssets.some(
    ({ kind, landingSiteId, daysLeft }) =>
      kind === "habitat" && landingSiteId === siteId && daysLeft > 0,
  );

/** The way home to choose this Turn, by its key, for a CrewStyle that brings Crew home: the first on offer, if any. */
export function wayHome(
  view: ProgramView,
  { roundTrip = false }: CrewStyle,
): string | undefined {
  return roundTrip
    ? view.crew.flatMap(({ waysHome }) => waysHome)[0]?.key
    : undefined;
}

/**
 * Where Crew who land go: a surveyed Landing Site, as Crew are worth more than any Asset, one not yet landed at before
 * one that has been, then the most Science. None until a Survey has made a site safer.
 */
function crewLandingSite(
  view: ProgramView,
  besideHabitat: boolean,
): string | undefined {
  const surveyed = view.landingSites.filter(({ surveyed }) => surveyed);
  const housed = besideHabitat
    ? surveyed.find(({ id }) => habitatAt(view, id))
    : undefined;
  return (
    housed ??
    surveyed.toSorted(
      (first, second) =>
        Number(first.landed) - Number(second.landed) ||
        second.science - first.science,
    )[0]
  )?.id;
}

/**
 * Crewed Missions with no Asset aboard, largest Crew first, then the most Supplies, then the most Protection, unless
 * the CrewStyle says the least, each on the cheapest Flight-proven Launch Vehicle that can carry it, with an Earth
 * return stage if it makes round trips, and with the Activity that earns the most Science. They go to Mars orbit, or
 * land at a surveyed Landing Site if the CrewStyle lands and there is one, each with a habitat aboard first if the
 * CrewStyle wants one and none operates there. None if no Launch Vehicle can carry Crew.
 */
export function crewedMissions(
  view: ProgramView,
  tools: PlanningTools,
  {
    lands = false,
    leastSupplies = false,
    noProtection = false,
    reliability = false,
    roundTrip = false,
    habitat = false,
  }: CrewStyle,
): PlannedMission[] {
  const landingSiteId =
    lands && !roundTrip ? crewLandingSite(view, habitat) : undefined;
  const habitatAboard =
    habitat && landingSiteId !== undefined && !habitatAt(view, landingSiteId)
      ? view.assets.find((asset) => asset.kind === "habitat" && canFly(asset))
      : undefined;
  const returnStage = roundTrip ? view.crewedMission.roundTrip.massTonnes : 0;
  const { supplies: allSupplies, protection: allProtection } =
    view.crewedMission;
  const supplies = leastSupplies
    ? allSupplies.slice(0, 1)
    : allSupplies.toReversed();
  const protection = noProtection
    ? allProtection.slice(0, 1)
    : allProtection.toReversed();
  const choices = view.crewedMission.sizes
    .toSorted((first, second) => second.crew - first.crew)
    .flatMap((size) => supplies.map((carried) => ({ size, carried })))
    .flatMap((choice) =>
      protection.map((shielding) => ({ ...choice, shielding })),
    );
  // Crew coming home face radiation on the way back too, so a round trip puts Protection before Crew size.
  const ordered = roundTrip
    ? choices.toSorted(
        (first, second) =>
          protection.indexOf(first.shielding) -
          protection.indexOf(second.shielding),
      )
    : choices;
  const missionsWith = (aboard: ProgramView["assets"][number] | undefined) =>
    ordered.flatMap(({ size: { crew, massTonnes }, carried, shielding }) => {
      const vehicle = view.launchVehicles
        .filter(
          (candidate) =>
            // Crew wait for a Launch Vehicle that has flown, as a careful player's would.
            candidate.technologyReadiness === "flight-proven" &&
            candidate.capacityTonnes >=
              massTonnes +
                carried.massTonnes +
                shielding.massTonnes +
                returnStage +
                (aboard?.massTonnes ?? 0),
        )
        .toSorted(
          (first, second) => first.costMillions - second.costMillions,
        )[0];
      if (!vehicle) return [];
      const mission = {
        launchVehicleId: vehicle.id,
        assetIds: aboard ? [aboard.id] : [],
        crew: {
          size: crew,
          landsAtSite: landingSiteId !== undefined,
          suppliesId: carried.id,
          protectionId: shielding.id,
          ...(roundTrip ? { roundTrip } : {}),
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
      const chosen = {
        ...mission,
        crew: { ...mission.crew, activityId: best?.id ?? planned.activityId },
      };
      return reliability ? [mostReliable(chosen, tools), chosen] : [chosen];
    });
  return [
    ...(habitatAboard ? missionsWith(habitatAboard) : []),
    ...missionsWith(undefined),
  ];
}

/** The Mission with the dearest Reliability on each of its Mission Events. */
function mostReliable(
  mission: PlannedMission,
  tools: PlanningTools,
): PlannedMission {
  return {
    ...mission,
    reliability: Object.fromEntries(
      tools
        .previewMission(mission)
        .map(({ eventId, reliabilityLevels }) => [
          eventId,
          reliabilityLevels.toSorted(
            (first, second) => second.costMillions - first.costMillions,
          )[0]?.id ?? "none",
        ]),
    ),
  };
}
