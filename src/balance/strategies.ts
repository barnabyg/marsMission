import { bigProgramStrategies } from "./bigProgramStrategies";
import { playStyle } from "./playStyle";
import { steadyStrategies } from "./steadyStrategies";
import type { Strategy } from "./strategy";
import {
  landThenOrbiter,
  landingStraightAway,
  steadyRovers,
  surveyingLanders,
  surveyingRovers,
} from "./styleParts";

/**
 * Every strategy the report covers, in its order, with the `steady:` and `big Program:` ones in files of their own. Add
 * one here, or to one of those lists, and it needs nothing else.
 */
export const strategies: Strategy[] = [
  {
    name: "launch nothing",
    description: "Never launches, so shows how fast Public Support fades.",
    plan: () => ({ mission: null }),
  },
  playStyle(
    "survey first",
    "An orbiter that Surveys while there is anything left to Survey, otherwise landers at surveyed sites.",
    surveyingLanders,
  ),
  playStyle(
    "survey first, Free-return",
    "As survey first, flying Free-return whenever a Mission has an arrival burn.",
    { ...surveyingLanders, trajectory: "free-return" },
  ),
  playStyle(
    "land straight away",
    "Landers at unsurveyed sites until one lands, and then the same as survey first.",
    landingStraightAway,
  ),
  playStyle(
    "survey first, Pinpoint Lander",
    "As survey first, sending the Pinpoint Lander, which starts unproven, in place of the other lander whenever it can afford it.",
    { ...surveyingLanders, prefers: ["pinpoint-lander"] },
  ),
  playStyle(
    "land straight away, Pinpoint Lander",
    "As land straight away, sending the Pinpoint Lander in place of the other lander whenever it can afford it.",
    { ...landingStraightAway, prefers: ["pinpoint-lander"] },
  ),
  playStyle(
    "favour Science",
    "Survey first with rovers when it can afford them, on the Activity that earns the most Science.",
    surveyingRovers,
  ),
  playStyle(
    "favour Research Grants",
    "Survey first with rovers when it can afford them, on the Activity that pays the most Research Grant.",
    { ...surveyingRovers, aim: "grants" },
  ),
  playStyle(
    "longer Service Life",
    "Survey first, buying the longest Service Life it can afford.",
    { ...surveyingLanders, longestServiceLife: true },
  ),
  playStyle(
    "Asset Reliability",
    "Survey first, buying the best Reliability for each Asset that it can afford.",
    { ...surveyingLanders, assetReliability: "best" },
  ),
  playStyle(
    "Mission Event Reliability",
    "Survey first, buying the best Reliability on every Mission Event that it can afford.",
    { ...surveyingLanders, missionEventReliability: true },
  ),
  playStyle(
    "research orbiter, then land",
    "One orbiter on research that never Surveys, then landers at unsurveyed sites.",
    {
      ...surveyingLanders,
      surveysFirst: false,
      onlySurveyedSites: false,
      order: (view) =>
        view.milestones.length === 0 ? ["orbiter", "lander"] : ["lander"],
    },
  ),
  playStyle(
    "orbiters: research only",
    "Keeps two orbiters on research and never lands.",
    {
      ...surveyingLanders,
      surveysFirst: false,
      order: () => ["orbiter"],
      assetLimit: 2,
    },
  ),
  playStyle(
    "orbiters: Survey first",
    "Keeps two orbiters and never lands. One Surveys until nothing is left to Survey, and the rest do research.",
    { ...surveyingLanders, order: () => ["orbiter"], assetLimit: 2 },
  ),
  playStyle(
    "keep two Assets",
    "Survey first with the longest Service Life, launching only to keep two Assets operating, to see what Ongoing Research sustains.",
    { ...surveyingLanders, longestServiceLife: true, assetLimit: 2 },
  ),
  playStyle(
    "stop after Turn 4",
    "Survey first with rovers on Research Grants, then launches nothing after Turn 4, to see that a Program with nothing left fades.",
    { ...surveyingRovers, aim: "grants", lastLaunchTurn: 4 },
  ),
  ...steadyStrategies,
  ...bigProgramStrategies,
  playStyle(
    "steady: Survey once",
    "As steady: Soil analysis, but the orbiter changes to research after its first Survey.",
    {
      ...steadyRovers,
      surveysWhile: (view) =>
        view.landingSites.every(({ surveyed }) => !surveyed),
    },
  ),
  // The two yardsticks for how the game rewards risk: Cautious should rarely be cancelled and progress slowly, Bold
  // should be cancelled often but progress fast when it isn't.
  playStyle(
    "cautious",
    "Surveys first and lands only at surveyed sites, buying Tested for each rover in service and the best Reliability on every Mission Event it can afford, and keeping more money back for a retry.",
    {
      ...steadyRovers,
      assetReliability: "cheapest",
      assetReliabilityFor: ["rover"],
      missionEventReliability: true,
      reserveMillions: 1500,
    },
  ),
  playStyle(
    "bold",
    "Sends a rover to an unsurveyed site on the first Turn, then fills the Meridian Heavy with one more Asset of each kind whenever it can afford it, keeping up to six Assets, with no Reliability and no money kept back.",
    {
      ...steadyRovers,
      order: landThenOrbiter("rover"),
      onlySurveyedSites: false,
      reserveMillions: 0,
      fillsVehicle: "meridian-heavy",
      assetLimit: 6,
    },
  ),
];
