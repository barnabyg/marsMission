import type { ProgramView } from "../simulation/simulation";
import {
  playStyle,
  surveyorInService,
  surveyThenLand,
  type PlayStyle,
  type Strategy,
} from "./playStyle";

const surveyingLanders: PlayStyle = {
  order: surveyThenLand(["lander"]),
  aim: "science",
  surveysFirst: true,
  onlySurveyedSites: true,
};

const surveyingRovers: PlayStyle = {
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
const landThenOrbiter = (kind: string) => (view: ProgramView) => {
  if (!view.landingSites.some(({ landed }) => landed)) return [kind];
  return view.milestones.some(({ id }) => id === "first-orbiter-at-mars")
    ? ["rover", "lander"]
    : ["orbiter"];
};

/**
 * Plays as a careful player would: one orbiter to Survey, then rovers, keeping money back for a retry and
 * launching only to keep a few Assets operating. The strategies built on it differ from it in one choice.
 */
const steadyRovers: PlayStyle = {
  order: (view) => [...orbiterForFirstSurvey(view), "rover", "lander"],
  aim: "grants",
  surveysFirst: true,
  onlySurveyedSites: true,
  longestServiceLife: ["rover"],
  assetLimit: 3,
  reserveMillions: 1000,
};

/** Every strategy the report covers. Add one here and it needs nothing else. */
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
    "land straight away",
    "Landers at unsurveyed sites until one lands, and then the same as survey first.",
    {
      ...surveyingLanders,
      onlySurveyedSites: false,
      order: (view) =>
        view.landingSites.some(({ landed }) => landed)
          ? surveyThenLand(["lander"])(view)
          : ["lander", "orbiter"],
    },
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
    "steady: Free-return",
    "As steady: Soil analysis, flying Free-return whenever a Mission has an arrival burn.",
    { ...steadyRovers, trajectory: "free-return" },
  ),
  playStyle(
    "steady: shelter from storms",
    "As steady: Soil analysis, sheltering from every dust storm.",
    { ...steadyRovers, dustStorms: "shelter" },
  ),
  playStyle(
    "steady: carry on through storms",
    "As steady: Soil analysis, carrying on through every dust storm.",
    { ...steadyRovers, dustStorms: "carryOn" },
  ),
  playStyle(
    "steady: Survey once",
    "As steady: Soil analysis, but the orbiter changes to research after its first Survey.",
    {
      ...steadyRovers,
      surveysWhile: (view) =>
        view.landingSites.every(({ surveyed }) => !surveyed),
    },
  ),
];
