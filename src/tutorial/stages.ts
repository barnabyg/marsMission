import type { ProgramView } from "../simulation/simulation";
import { crewAtBase } from "./base";
import {
  baseComplete,
  crewVehicleBuilt,
  crewVehicleProven,
  crewVehicleUnderWay,
  surveyStarted,
} from "./route";

export type StageId =
  | "firstOrbiter"
  | "landingAndSurveys"
  | "roversAndGrants"
  | "developingColossus"
  | "buildingBase"
  | "landingCrew";

export interface Stage {
  id: StageId;
  name: string;
  /** One sentence: what this stage is for. */
  aim: string;
}

/** The route, in order. */
export const stages: readonly Stage[] = [
  {
    id: "firstOrbiter",
    name: "First orbiter",
    aim: "An orbiter Surveys the Landing Sites, so that every later landing is safer.",
  },
  {
    id: "landingAndSurveys",
    name: "Landing and Surveys",
    aim: "A first rover lands at a surveyed Landing Site while the orbiter goes on Surveying.",
  },
  {
    id: "roversAndGrants",
    name: "Rovers and Research Grants",
    aim: "Rovers earn Research Grants until there is the money to develop the Meridian Colossus.",
  },
  {
    id: "developingColossus",
    name: "Developing the Meridian Colossus",
    aim: "Development makes the Meridian Colossus ready to fly: the only Launch Vehicle big enough for Crew or a whole Base.",
  },
  {
    id: "buildingBase",
    name: "Building the Base",
    aim: "A fuel plant, a Habitat and a Mars lab land together at one surveyed Landing Site to make the Base.",
  },
  {
    id: "landingCrew",
    name: "Landing Crew",
    aim: "Crew land at the Base on a round trip, once the Meridian Colossus has flown.",
  },
];

/** Where the Program is on the route, worked out afresh from what the player sees. */
export function stageOf(view: ProgramView): StageId {
  if (crewAtBase(view)) return "landingCrew";
  if (!surveyStarted(view)) return "firstOrbiter";
  if (!view.landingSites.some(({ landed }) => landed)) {
    return "landingAndSurveys";
  }
  if (!crewVehicleUnderWay(view)) return "roversAndGrants";
  if (!crewVehicleBuilt(view)) return "developingColossus";
  if (!baseComplete(view) || !crewVehicleProven(view)) return "buildingBase";
  return "landingCrew";
}
