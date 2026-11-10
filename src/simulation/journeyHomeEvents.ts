import type { Catalogue } from "../catalogue/catalogue";
import type { PlannedMission } from "./types";
import { isLandingSiteKey } from "./crewPlaces";
import type { Asset, MissionEvent } from "./rules";

/** The Mission Events of a journey home, of Crew or of samples, which `createRules` hands on as its own. */
export function createJourneyHomeEvents(catalogue: Catalogue) {
  /**
   * The Mission Events of a round trip's journey home, in the order they happen after leaving Mars, with Mars ascent and
   * the rendezvous first for Crew leaving a Landing Site. The sort is stable, so those on the same day keep their order.
   */
  function journeyHomeEvents(fromSurface = false): MissionEvent[] {
    return fromSurface ? fromSurfaceHome : fromOrbitHome;
  }

  function eventsHome(fromSurface: boolean): MissionEvent[] {
    const { roundTrip } = catalogue.crew;
    return [
      ...(fromSurface ? roundTrip.ascent.missionEvents : []),
      ...roundTrip.missionEvents,
    ]
      .flatMap((eventId) =>
        catalogue.missionEvents.filter((event) => event.id === eventId),
      )
      .sort((first, second) => first.timing.days - second.timing.days);
  }

  // Worked out once, as balance runs ask for them for every plan they check. Callers never change them.
  const fromOrbitHome = eventsHome(false);
  const fromSurfaceHome = eventsHome(true);

  /**
   * The Mission Events an ascent vehicle or an Earth return orbiter flies when it sends samples home: Mars ascent and
   * the rendezvous for an ascent vehicle, and the journey home's for an orbiter, as Crew fly them. Any other Asset flies
   * none.
   */
  function sampleReturnEventsOf(asset: Asset): MissionEvent[] {
    const { roundTrip } = catalogue.crew;
    const eventIds =
      asset.sampleReturn === "ascent"
        ? roundTrip.ascent.missionEvents
        : asset.sampleReturn === "earthReturn"
          ? roundTrip.missionEvents
          : [];
    return journeyHomeEvents(true).filter(({ id }) => eventIds.includes(id));
  }

  /** The Mission Events of the journey home that a Mission's own Crew, or the Crew its return vehicle fetches, fly. */
  function crewHomewardEventsFor(
    mission: PlannedMission | null,
  ): MissionEvent[] {
    if (mission?.crew?.roundTrip) {
      return journeyHomeEvents(mission.crew.landsAtSite === true);
    }
    return mission?.returnVehicle
      ? journeyHomeEvents(isLandingSiteKey(mission.returnVehicle.forCrewAt))
      : [];
  }

  /**
   * The Mission Events of a journey home on a later Turn that a Mission buys Reliability and Contingency for: its own
   * Crew's on a round trip, or those of the Crew its return vehicle fetches, through Mars ascent if they are at a
   * Landing Site, and those its ascent vehicle and Earth return orbiter fly to send samples home, in the order they
   * happen. A Mission Event that more than one of them flies is bought once, for them all. A Mission with none of them
   * has none.
   */
  function homewardEventsFor(mission: PlannedMission | null): MissionEvent[] {
    const sampleReturn = catalogue.assets.filter(
      ({ id, sampleReturn: part }) =>
        part !== undefined && mission?.assetIds.includes(id),
    );
    if (sampleReturn.length === 0) return crewHomewardEventsFor(mission);
    const flown = new Set([
      ...crewHomewardEventsFor(mission),
      ...sampleReturn.flatMap(sampleReturnEventsOf),
    ]);
    return journeyHomeEvents(true).filter((event) => flown.has(event));
  }

  return {
    journeyHomeEvents,
    homewardEventsFor,
    crewHomewardEventsFor,
    sampleReturnEventsOf,
  };
}
