import type { Rules } from "./rules";
import type { CrewMember, PlaceAtMars, PlannedMission, Program } from "./types";

/** Where Crew are: Mars orbit or a Landing Site, each a place of its own, and which of the Program's Crew are at Mars. */

/** Crew in Mars orbit, where a Crewed Mission goes unless its Crew land. */
const marsOrbit = { kind: "marsOrbit" } as const;

/** How a plan names a place where Crew operate. Each Landing Site is a place of its own. */
export function crewKeyOf(location: PlaceAtMars): string {
  return location.kind === "marsOrbit"
    ? "mars-orbit"
    : `landing-site:${location.landingSiteId}`;
}

/** Where Crew are, as the player reads it: Mars orbit, or their Landing Site's name. */
export function locationNameOf(rules: Rules, location: PlaceAtMars): string {
  return location.kind === "marsOrbit"
    ? "Mars orbit"
    : (rules.landingSiteById(location.landingSiteId)?.name ??
        location.landingSiteId);
}

/** Where a Mission's Crew go: to its Landing Site if they land there, and otherwise to Mars orbit. */
export function placeFor(mission: PlannedMission | null): PlaceAtMars {
  return mission?.crew?.landsAtSite && mission.landingSiteId !== undefined
    ? { kind: "landingSite", landingSiteId: mission.landingSiteId }
    : marsOrbit;
}

/** A Crew member operating at Mars, who is neither lost nor home. */
export type CrewMemberAtMars = CrewMember & {
  arrivedOn: string;
  location: PlaceAtMars;
};

const isAtMars = (member: CrewMember): member is CrewMemberAtMars =>
  (member.location.kind === "marsOrbit" ||
    member.location.kind === "landingSite") &&
  member.arrivedOn !== null;

/** The Program's Crew operating at Mars, in the order they arrived, leaving out those who are lost or home. */
export function crewAtMarsOf(program: Program): CrewMemberAtMars[] {
  return program.crew.filter(isAtMars);
}
