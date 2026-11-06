import { playStyle } from "./playStyle";
import type { Strategy } from "./strategy";
import {
  landThenOrbiter,
  relayBesideRovers,
  relayWanted,
  steadyRovers,
} from "./styleParts";

/**
 * The strategies named `steady:`, which each differ from `steady: Soil analysis` in one choice, in the order the report
 * lists them. `strategies.ts` lists them among the rest.
 */
export const steadyStrategies: Strategy[] = [
  playStyle(
    "steady: Soil analysis",
    "One orbiter, then rovers on Soil analysis with the longest Service Life, keeping three Assets and some money back.",
    steadyRovers,
  ),
  playStyle(
    "steady: Long traverse",
    "The same, with rovers on Long traverse.",
    {
      ...steadyRovers,
      aim: "science",
    },
  ),
  playStyle(
    "steady: Soil, traverse when rich",
    "The same, with rovers on Soil analysis until money passes the cost of several rovers, then on Long traverse.",
    {
      ...steadyRovers,
      aim: (view) => (view.moneyMillions >= 5000 ? "science" : "grants"),
    },
  ),
  playStyle(
    "steady: shortest Service Life",
    "As steady: Soil analysis, with the shortest Service Life.",
    { ...steadyRovers, longestServiceLife: false },
  ),
  playStyle(
    "steady: longest on everything",
    "As steady: Soil analysis, also buying the longest Service Life for orbiters and landers.",
    { ...steadyRovers, longestServiceLife: true },
  ),
  playStyle(
    "steady: shortest, Tested",
    "As steady: shortest Service Life, buying the cheapest Reliability for each Asset.",
    {
      ...steadyRovers,
      longestServiceLife: false,
      assetReliability: "cheapest",
    },
  ),
  playStyle(
    "steady: Tested rovers",
    "As steady: Soil analysis, buying the cheapest Reliability for each rover.",
    {
      ...steadyRovers,
      assetReliability: "cheapest",
      assetReliabilityFor: ["rover"],
    },
  ),
  playStyle(
    "steady: best on rovers",
    "As steady: Soil analysis, buying the best Reliability for each rover that it can afford.",
    {
      ...steadyRovers,
      assetReliability: "best",
      assetReliabilityFor: ["rover"],
    },
  ),
  playStyle(
    "steady: Tested everything",
    "As steady: Soil analysis, buying the cheapest Reliability for every Asset, including the orbiter and any lander.",
    { ...steadyRovers, assetReliability: "cheapest" },
  ),
  playStyle(
    "steady: land straight away",
    "As steady: Soil analysis, but with no orbiter: a lander goes to an unsurveyed site on the first Turn, then rovers.",
    {
      ...steadyRovers,
      order: landThenOrbiter("lander"),
      onlySurveyedSites: false,
    },
  ),
  playStyle(
    "steady: rover straight away",
    "As steady: Soil analysis, but with no orbiter: a rover goes to an unsurveyed site on the first Turn.",
    {
      ...steadyRovers,
      order: landThenOrbiter("rover"),
      onlySurveyedSites: false,
      reserveMillions: 0,
    },
  ),
  playStyle(
    "steady: rover at once",
    "As steady: Soil analysis, but keeping no money back, so the first landing is a rover.",
    { ...steadyRovers, reserveMillions: 0 },
  ),
  playStyle(
    "steady: Contingency, used",
    "As steady: Soil analysis, buying every Contingency it can afford and using it when it's needed.",
    { ...steadyRovers, contingencies: "use" },
  ),
  playStyle(
    "steady: Contingency, declined",
    "As steady: Soil analysis, buying every Contingency it can afford and never using it, to show what they cost.",
    { ...steadyRovers, contingencies: "decline" },
  ),
  playStyle(
    "steady: Fast",
    "As steady: Soil analysis, flying Fast whenever it can afford to, for more days of research.",
    { ...steadyRovers, trajectory: "fast" },
  ),
  playStyle(
    "steady: Contingency when rich",
    "As steady: Soil analysis, buying every Contingency it can afford once it has $3B, and using it.",
    {
      ...steadyRovers,
      contingencies: "use",
      contingenciesWhile: (view) => view.moneyMillions >= 3000,
    },
  ),
  playStyle(
    "steady: Fast when rich",
    "As steady: Soil analysis, flying Fast once it has the money for several rovers.",
    {
      ...steadyRovers,
      trajectory: "fast",
      trajectoryWhile: (view) => view.moneyMillions >= 5000,
    },
  ),
  playStyle(
    "steady: Free-return first",
    "As steady: Soil analysis, flying Free-return on its first Mission, the orbiter, while a loss would hurt most.",
    {
      ...steadyRovers,
      trajectory: "free-return",
      trajectoryWhile: (view) => view.turnNumber === 1,
    },
  ),
  playStyle(
    "steady: Free-return",
    "As steady: Soil analysis, flying Free-return whenever a Mission has an arrival burn.",
    { ...steadyRovers, trajectory: "free-return" },
  ),
  playStyle(
    "steady: carry on through storms",
    "As steady: Soil analysis, carrying on through every dust storm.",
    { ...steadyRovers, dustStorms: "carryOn" },
  ),
  playStyle(
    "steady: carry on through radiation",
    "As steady: Soil analysis, carrying on through every solar particle event.",
    { ...steadyRovers, solarParticleEvents: "carryOn" },
  ),
  playStyle(
    "steady: land in storms",
    "As steady: Soil analysis, going ahead with every landing that a dust storm's go/no-go check would hold off.",
    { ...steadyRovers, goNoGo: "go" },
  ),
  playStyle(
    "steady: Long traverse, carry on through storms",
    "As steady: Long traverse, carrying on through every dust storm.",
    { ...steadyRovers, aim: "science", dustStorms: "carryOn" },
  ),
  playStyle(
    "steady: Long traverse, carry on through radiation",
    "As steady: Long traverse, carrying on through every solar particle event.",
    { ...steadyRovers, aim: "science", solarParticleEvents: "carryOn" },
  ),
  playStyle(
    "steady: Long traverse, land in storms",
    "As steady: Long traverse, going ahead with every landing in a dust storm.",
    { ...steadyRovers, aim: "science", goNoGo: "go" },
  ),
  playStyle(
    "steady: develop the Endurance Rover",
    "As steady: Soil analysis, starting Development of the Endurance Rover as soon as it can afford it on top of the Turn's Mission, and sending it in place of the other rover once it is built.",
    {
      ...steadyRovers,
      develops: ["endurance-rover"],
      prefers: ["endurance-rover"],
    },
  ),
  playStyle(
    "steady: develop the Endurance Rover when rich",
    "The same, starting that Development only once it has the money for several rovers.",
    {
      ...steadyRovers,
      develops: ["endurance-rover"],
      developsWhile: (view) => view.moneyMillions >= 5000,
      prefers: ["endurance-rover"],
    },
  ),
  playStyle(
    "steady: develop the Meridian Colossus",
    "As steady: Soil analysis, starting Development of the Meridian Colossus as soon as it can afford it on top of the Turn's Mission, and once it is built flying it with one more Asset of each kind, with the Activity each lists first, as many as it can afford.",
    {
      ...steadyRovers,
      develops: ["meridian-colossus"],
      fillsVehicle: "meridian-colossus",
    },
  ),
  playStyle(
    "steady: develop the Meridian Colossus when rich",
    "The same, starting that Development only once it has the money for several rovers.",
    {
      ...steadyRovers,
      develops: ["meridian-colossus"],
      developsWhile: (view) => view.moneyMillions >= 5000,
      fillsVehicle: "meridian-colossus",
    },
  ),
  playStyle(
    "steady: Courier Relay",
    "As steady: Soil analysis, sending the Courier Relay, a relay orbiter whose Benefit raises surface research, in place of the other orbiter whenever it can afford it.",
    { ...steadyRovers, prefers: ["courier-relay-orbiter"] },
  ),
  playStyle(
    "steady: relay when rich",
    "As steady: Courier Relay, also sending another relay orbiter before more rovers once it has the money for several rovers, whenever none is operating and something on the surface is.",
    {
      ...steadyRovers,
      prefers: ["courier-relay-orbiter"],
      order: (view) =>
        relayWanted(view) && view.moneyMillions >= 5000
          ? ["orbiter", "rover", "lander"]
          : steadyRovers.order(view),
    },
  ),
  playStyle(
    "steady: relay beside rovers",
    "As steady: Soil analysis, also sending the Courier Relay before more rovers whenever none is operating and two or more Assets are on the surface.",
    relayBesideRovers,
  ),
];
