import type { CrewStyle } from "../balance/crewPlay";
import type { PlayStyle } from "../balance/playStyleOptions";
import { surveyorInService } from "../balance/playStyle";
import { bigProgram } from "../balance/styleParts";
import type { ProgramView } from "../simulation/simulation";
import { baseKinds, crewAtBase } from "./base";

/* The tutorial's route to a Base with Crew at it, as a play style, and the tests of the Program the route turns on. */

/** The Money at which the route starts the Development of the Launch Vehicle that carries Crew. */
const developAtMillions = 5000;

/** The Money at which the route sends the whole Base, once that Launch Vehicle is built. */
export const baseAtMillions = 6000;

/** How many rovers it keeps at the Base while it saves for Crew. */
const roversWhileSaving = 2;

/** The Launch Vehicle that carries Crew: the one that carries most, which on the real Catalogue is the Meridian Colossus. */
export const crewVehicleOf = (view: ProgramView) =>
  view.launchVehicles.toSorted(
    (first, second) => second.capacityTonnes - first.capacityTonnes,
  )[0];

/** Whether that Launch Vehicle's Development has started, or it needs none. */
export const crewVehicleUnderWay = (view: ProgramView) =>
  view.developments.find(({ id }) => id === crewVehicleOf(view)?.id)?.status !==
  "notStarted";

/** Whether that Launch Vehicle can fly this Turn. */
export const crewVehicleBuilt = (view: ProgramView) =>
  crewVehicleOf(view)?.technologyReadiness !== "not-built";

/** Whether that Launch Vehicle has flown, so that Crew can fly on it. */
export const crewVehicleProven = (view: ProgramView) =>
  crewVehicleOf(view)?.technologyReadiness === "flight-proven";

/** Whether a Survey has been done or is under way, or none is left to do, so that the first orbiter has done its job. */
export const surveyStarted = (view: ProgramView) =>
  surveyorInService(view) ||
  view.landingSites.some(({ surveyed }) => surveyed) ||
  !view.somethingLeftToSurvey;

/** Whether an Asset of this kind operates with Service Life left this Turn at this Landing Site. */
const inServiceAt = (view: ProgramView, kind: string, siteId: string) =>
  view.operatingAssets.some(
    (asset) =>
      asset.kind === kind &&
      asset.landingSiteId === siteId &&
      asset.daysLeft > 0,
  );

/** The kinds of a Base with none in service this Turn at this Landing Site. */
const lackingAt = (view: ProgramView, siteId: string) =>
  baseKinds.filter((kind) => !inServiceAt(view, kind, siteId));

/**
 * The Landing Site of the Base: where parts of it are in service, the one with the most first, or once the Launch
 * Vehicle for Crew is under way, the surveyed site with the most Science. None until then.
 */
export function baseSite(view: ProgramView): string | undefined {
  const withParts = view.landingSites
    .map(({ id }) => ({ id, lacking: lackingAt(view, id).length }))
    .filter(({ lacking }) => lacking < baseKinds.length)
    .toSorted((first, second) => first.lacking - second.lacking)[0];
  if (withParts) return withParts.id;
  if (!crewVehicleUnderWay(view)) return undefined;
  return view.landingSites
    .filter(({ surveyed }) => surveyed)
    .toSorted((first, second) => second.science - first.science)[0]?.id;
}

/** The parts of the Base not in service this Turn at its site, in the order the route lands them. None with no site. */
export function partsMissing(view: ProgramView): string[] {
  const site = baseSite(view);
  return site === undefined ? [] : lackingAt(view, site);
}

/** Whether a part of the Base is in service anywhere. */
const baseBegun = (view: ProgramView) =>
  view.landingSites.some(
    ({ id }) => lackingAt(view, id).length < baseKinds.length,
  );

/**
 * The parts of the Base to land this Turn: none until the Launch Vehicle for Crew is built and there is the money for
 * the whole Base, and then whichever are missing.
 */
const partsWanted = (view: ProgramView): string[] =>
  crewVehicleBuilt(view) &&
  (baseBegun(view) || view.moneyMillions >= baseAtMillions)
    ? partsMissing(view)
    : [];

/** Whether the Base is complete for this Turn, so that Crew could land there. */
export const baseComplete = (view: ProgramView) =>
  baseSite(view) !== undefined && partsMissing(view).length === 0;

/** How many rovers are in service at the Base's Landing Site. */
const roversAtBase = (view: ProgramView) => {
  const site = baseSite(view);
  return view.operatingAssets.filter(
    ({ kind, daysLeft, landingSiteId }) =>
      kind === "rover" && daysLeft > 0 && landingSiteId === site,
  ).length;
};

/** Whether Crew could fly to a complete Base, so that the route saves for them. */
const crewWanted = (view: ProgramView) =>
  baseComplete(view) && crewVehicleProven(view) && !crewAtBase(view);

/** Whether the route is saving for Crew and has as many rovers at the Base as it keeps while it does. */
export const savingForCrew = (view: ProgramView) =>
  crewWanted(view) && roversAtBase(view) >= roversWhileSaving;

/**
 * The route's Crew: the fewest, on a round trip landing at the Base beside its fuel plant, only with the best Reliability
 * on every Mission Event, and with the most Protection and then Supplies that fit. They come home once one of them has
 * less than 45 Health or their Supplies wouldn't last another Turn.
 */
const tutorialCrew: CrewStyle = {
  reliability: true,
  onlyMostReliable: true,
  roundTrip: true,
  besideFuelPlant: true,
  homeBelowHealth: 45,
  fewestCrew: true,
};

/**
 * The route, for the Launch Vehicle that carries Crew: an orbiter to Survey, rovers on Research Grants, that Launch
 * Vehicle developed once there is money for it, then the whole Base on its first flight at one surveyed Landing Site,
 * and Crew landed there. Every Mission buys the best Reliability on its Mission Events that it can afford, the rovers
 * and the parts of the Base their longest Service Life, and the parts of the Base the best Reliability. It keeps no
 * money back, never ends a mission to free money, and sends no landers, which earn no Research Grants.
 */
export function routeStyle(view: ProgramView): PlayStyle {
  const vehicle = crewVehicleOf(view)?.id;
  return {
    ...bigProgram,
    reserveMillions: 0,
    longestServiceLife: ["rover", ...baseKinds],
    missionEventReliability: true,
    assetReliability: "best",
    assetReliabilityFor: [...baseKinds],
    buildsWell: [...baseKinds],
    baseSite,
    ...(vehicle === undefined
      ? {}
      : { develops: [vehicle], fillsVehicle: vehicle }),
    developsWhile: (given) => given.moneyMillions >= developAtMillions,
    fillsWhile: (given) => partsWanted(given).length > 1,
    fliesCrew: tutorialCrew,
    fliesCrewWhile: crewWanted,
    endsMissionsToLaunch: false,
    order: (given) => {
      if (crewWanted(given)) return savingForCrew(given) ? [] : ["rover"];
      if (!surveyStarted(given)) return ["orbiter"];
      return [
        ...partsWanted(given),
        ...bigProgram.order(given).filter((kind) => kind !== "lander"),
      ];
    },
  };
}
