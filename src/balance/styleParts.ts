import { canFly, type ProgramView } from "../simulation/simulation";
import type { CrewStyle } from "./crewPlay";
import { richMillions, siteNeedingAscent } from "./assetMissions";
import { surveyorInService, surveyThenLand } from "./playStyle";
import type { PlayStyle } from "./playStyleOptions";

/** The play styles and tests of a Program that the strategies are built from. */

export const surveyingLanders: PlayStyle = {
  order: surveyThenLand(["lander"]),
  aim: "science",
  surveysFirst: true,
  onlySurveyedSites: true,
};

/** Landers at unsurveyed sites until one lands, and then the same as surveyingLanders. */
export const landingStraightAway: PlayStyle = {
  ...surveyingLanders,
  onlySurveyedSites: false,
  order: (view) =>
    view.landingSites.some(({ landed }) => landed)
      ? surveyThenLand(["lander"])(view)
      : ["lander", "orbiter"],
};

export const surveyingRovers: PlayStyle = {
  ...surveyingLanders,
  order: surveyThenLand(["rover", "lander"]),
};

/** An orbiter's first Survey, while none has been done and none is under way. */
const orbiterForFirstSurvey = (view: ProgramView) =>
  !surveyorInService(view) &&
  view.landingSites.every(({ surveyed }) => !surveyed)
    ? ["orbiter"]
    : [];

/** This kind of Asset until something has landed, then an orbiter for its Milestone and Surveys, then the same as the others. */
export const landThenOrbiter = (kind: string) => (view: ProgramView) => {
  if (!view.landingSites.some(({ landed }) => landed)) return [kind];
  return view.milestones.some(({ id }) => id === "first-orbiter-at-mars")
    ? ["rover", "lander"]
    : ["orbiter"];
};

/** Whether no relay orbiter is operating while something on the surface is, so that a relay would raise its research. */
export const relayWanted = (view: ProgramView) => {
  const operating = view.operatingAssets.filter(({ daysLeft }) => daysLeft > 0);
  return (
    operating.some(({ landingSiteId }) => landingSiteId !== null) &&
    !operating.some(({ assetId }) => assetId === "courier-relay-orbiter")
  );
};

/** How many Assets are operating on the surface with Service Life left. */
const onSurface = (view: ProgramView) =>
  view.operatingAssets.filter(
    ({ daysLeft, landingSiteId }) => daysLeft > 0 && landingSiteId !== null,
  ).length;

/**
 * Plays as a careful player would: one orbiter to Survey, then rovers, keeping money back for a retry and
 * launching only to keep a few Assets operating. The strategies built on it differ from it in one choice.
 */
export const steadyRovers: PlayStyle = {
  order: (view) => [...orbiterForFirstSurvey(view), "rover", "lander"],
  aim: "grants",
  surveysFirst: true,
  onlySurveyedSites: true,
  longestServiceLife: ["rover"],
  assetLimit: 3,
  reserveMillions: 1000,
};

/** Whether a relay orbiter would raise the research of two or more Assets on the surface, with none operating. */
const relayForRovers = (view: ProgramView) =>
  relayWanted(view) && onSurface(view) >= 2;

/** As steadyRovers, with the Courier Relay sent before more rovers whenever relayForRovers. */
export const relayBesideRovers: PlayStyle = {
  ...steadyRovers,
  prefers: (view) => (relayForRovers(view) ? ["courier-relay-orbiter"] : []),
  order: (view) =>
    relayForRovers(view)
      ? ["orbiter", "rover", "lander"]
      : steadyRovers.order(view),
};

/** As relayBesideRovers, keeping more Assets, so that one Mission a Turn can hold it back once it is rich. */
export const bigProgram: PlayStyle = { ...relayBesideRovers, assetLimit: 6 };

/**
 * Whether it is rich and a Mars lab that can fly would add money this Turn, as its Benefit tag says, so that one is
 * worth landing.
 */
const labWanted = (view: ProgramView) =>
  view.moneyMillions >= 5000 &&
  view.assets.some(
    (asset) =>
      canFly(asset) && (asset.grantImpact?.extraGrantMillions ?? 0) > 0,
  );

/**
 * As bigProgram, landing a Mars lab with its longest Service Life before anything else once rich, whenever one would
 * add money, where it would add most.
 */
export const labBesideRovers: PlayStyle = {
  ...bigProgram,
  longestServiceLife: ["rover", "lab"],
  order: (view) =>
    labWanted(view)
      ? ["lab", ...bigProgram.order(view)]
      : bigProgram.order(view),
};

/** As bigProgram, developing the Meridian Colossus once rich and filling it once it is built. */
export const colossusWhenRich: PlayStyle = {
  ...bigProgram,
  develops: ["meridian-colossus"],
  developsWhile: (view) => view.moneyMillions >= 5000,
  fillsVehicle: "meridian-colossus",
  fillsWhile: (view) => view.moneyMillions >= 5000,
};

/** Whether it is rich and has no fuel plant operating with Service Life left, so that one would be worth landing. */
const fuelPlantWanted = (view: ProgramView) =>
  view.moneyMillions >= 5000 &&
  !view.operatingAssets.some(
    ({ kind, daysLeft }) => kind === "fuel-plant" && daysLeft > 0,
  );

/** As colossusWhenRich, landing a fuel plant before anything else once rich, while none is operating. */
export const fuelPlantWhenRich: PlayStyle = {
  ...colossusWhenRich,
  order: (view) => [
    ...(fuelPlantWanted(view) ? ["fuel-plant"] : []),
    ...colossusWhenRich.order(view),
  ],
};

/** Crew sent to Mars orbit with the best Reliability it can afford, as they are worth more than any Asset. */
export const crewInOrbit: CrewStyle = { reliability: true };
/** The same Crew on a round trip to Mars orbit, brought home on the first Turn it can. */
export const crewRoundTrip: CrewStyle = { ...crewInOrbit, roundTrip: true };
/** The same Crew sent one way, and fetched with a return vehicle once they are at Mars, then brought home. */
export const crewFetched: CrewStyle = { ...crewInOrbit, fetches: true };
/** The same Crew landing at a surveyed Landing Site once there is one. */
export const crewLanding: CrewStyle = { ...crewInOrbit, lands: true };
/** The same Crew on a round trip landing beside a fuel plant, once one operates, and brought home through Mars ascent. */
export const crewHomeFromFuelPlant: CrewStyle = {
  ...crewRoundTrip,
  besideFuelPlant: true,
};
/** The same landing Crew beside a habitat, which goes with them if none operates at a surveyed Landing Site. */
export const crewBesideHabitat: CrewStyle = { ...crewLanding, habitat: true };

/**
 * Whether it is rich and a Landing Site with samples has no ascent vehicle, or samples wait with no Earth return orbiter
 * in Mars orbit, which says which of them it would send.
 */
const sampleReturnWanted = (view: ProgramView): string[] => {
  if (view.moneyMillions < richMillions) return [];
  const orbiterWaiting = view.operatingAssets.some(
    ({ kind, daysLeft }) => kind === "return-orbiter" && daysLeft > 0,
  );
  const samplesWaiting = view.landingSites.some(({ samples }) => samples > 0);
  return [
    ...(siteNeedingAscent(view) ? ["ascent-vehicle"] : []),
    ...(samplesWaiting && !orbiterWaiting ? ["return-orbiter"] : []),
  ];
};

/**
 * As bigProgram, with one rover caching samples once rich, and the rovers beside an ascent vehicle, then landing an
 * ascent vehicle where they wait and an Earth return orbiter for them, together on the Meridian Heavy when both are
 * wanted, before anything else, and sending them home on the first Turn it can.
 */
export const samplesHomeFromRovers: PlayStyle = {
  ...bigProgram,
  cachesSamples: true,
  order: (view) => [...sampleReturnWanted(view), ...bigProgram.order(view)],
  fillsVehicle: "meridian-heavy",
  fillsWhile: (view) => sampleReturnWanted(view).length > 1,
};
