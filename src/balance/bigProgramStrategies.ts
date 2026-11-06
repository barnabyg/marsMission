import { playStyle } from "./playStyle";
import type { Strategy } from "./strategy";
import {
  bigProgram,
  colossusWhenRich,
  crewInOrbit,
  crewLanding,
  crewBesideHabitat,
  crewRoundTrip,
  fuelPlantWhenRich,
  labBesideRovers,
} from "./styleParts";

/**
 * The strategies named `big Program:`, which keep up to six Assets, and those of them that fly Crew, in the order the
 * report lists them. `strategies.ts` lists them among the rest.
 */
export const bigProgramStrategies: Strategy[] = [
  playStyle(
    "big Program: one Asset per Mission",
    "As steady: relay beside rovers, keeping up to six Assets, and keeping to what is Flight-proven: one Asset per Mission.",
    bigProgram,
  ),
  playStyle(
    "big Program: land a Mars lab beside rovers",
    "As big Program: one Asset per Mission, also landing Curie Station, with its longest Service Life, before anything else whenever it has the money for several rovers and its Benefit tag says it would add money this Turn, at the Landing Site where it would add most, so that it raises the Research Grants of the rovers there.",
    labBesideRovers,
  ),
  playStyle(
    "big Program: fill the Meridian Heavy when rich",
    "The same, flying the Meridian Heavy with one more Asset of each kind once it has the money for several rovers, as many as fit and it can afford.",
    {
      ...bigProgram,
      fillsVehicle: "meridian-heavy",
      fillsWhile: (view) => view.moneyMillions >= 5000,
    },
  ),
  playStyle(
    "big Program: develop the Meridian Colossus when rich",
    "The same, starting Development of the Meridian Colossus once it has the money for several rovers, and filling the Meridian Colossus once it is built: a relay orbiter, a rover and a lander can go together.",
    colossusWhenRich,
  ),
  playStyle(
    "big Program: develop the Meridian Colossus and fly Crew when rich",
    "As big Program: develop the Meridian Colossus when rich, also sending a Crewed Mission to Mars orbit once the Meridian Colossus is Flight-proven, before any Asset whenever it can afford one and keep its reserve: the largest Crew it can afford, with the most Supplies and then the most Protection that fit, and the best Reliability on every Mission Event that it can afford.",
    { ...colossusWhenRich, fliesCrew: crewInOrbit },
  ),
  playStyle(
    "big Program: fly Crew on a round trip and bring them home",
    "As big Program: develop the Meridian Colossus and fly Crew when rich, but its Crew go on a round trip, with an Earth return stage, the most Protection that fits before the largest Crew, and the best Reliability it can afford on the way home too, and come home on the first Turn they can.",
    { ...colossusWhenRich, fliesCrew: crewRoundTrip },
  ),
  playStyle(
    "big Program: develop the Meridian Colossus and land Crew when rich",
    "As big Program: develop the Meridian Colossus and fly Crew when rich, but its Crew land at a surveyed Landing Site, one not yet landed at if it can, once a Survey has made one safer, and go to Mars orbit until then.",
    { ...colossusWhenRich, fliesCrew: crewLanding },
  ),
  playStyle(
    "big Program: land Crew and a fuel plant",
    "As big Program: develop the Meridian Colossus and land Crew when rich, also landing the Wellspring Fuel Plant at a surveyed Landing Site before any other Asset whenever it has the money for several rovers and none is operating, so that ascent propellant builds up for Crew to leave the surface.",
    { ...fuelPlantWhenRich, fliesCrew: crewLanding },
  ),
  playStyle(
    "big Program: land Crew beside a habitat",
    "As big Program: develop the Meridian Colossus and land Crew when rich, but its Crew land at a surveyed Landing Site where a Haven Module operates, if there is one, and otherwise take one with them whenever it fits and can be afforded, so that they lose less Health to time at Mars and have its Supplies.",
    { ...colossusWhenRich, fliesCrew: crewBesideHabitat },
  ),
  playStyle(
    "big Program: land Crew, least Supplies",
    "As big Program: develop the Meridian Colossus and land Crew when rich, with the least Supplies, which leaves room for more Protection.",
    { ...colossusWhenRich, fliesCrew: { ...crewLanding, leastSupplies: true } },
  ),
  playStyle(
    "big Program: land Crew, no Protection",
    "As big Program: develop the Meridian Colossus and land Crew when rich, with no Protection.",
    { ...colossusWhenRich, fliesCrew: { ...crewLanding, noProtection: true } },
  ),
  playStyle(
    "big Program: land Crew, no Protection, least Supplies",
    "As big Program: land Crew, no Protection, also with the least Supplies, which last about as long as Health without Protection does.",
    {
      ...colossusWhenRich,
      fliesCrew: { ...crewLanding, noProtection: true, leastSupplies: true },
    },
  ),
  playStyle(
    "big Program: land Crew, carry on through radiation",
    "As big Program: develop the Meridian Colossus and land Crew when rich, carrying on through every solar particle event with Crew aboard.",
    {
      ...colossusWhenRich,
      fliesCrew: { ...crewLanding, solarParticleEvents: "carryOn" },
    },
  ),
];
