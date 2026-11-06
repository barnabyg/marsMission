import type { Catalogue } from "../catalogue/catalogue";
import type { MilestoneAward } from "./scienceMilestones";
import type { CrewHomeEntry } from "./timeline";
import type { Program } from "./types";

/**
 * Crew coming home safe, from a journey home or on a Free-return: each Crew member earns the Catalogue's Public Support
 * for a safe return on the day they get home, and the first Crew home earn the Milestone for it. They never fly again.
 */

/** Crew who got home safe together on one day of the Turn. */
export interface Homecoming {
  names: string[];
  day: number;
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** What the Turn's homecomings earn: Public Support for each Crew member, on their day, and the First Crew home Milestone. */
export function welcomeCrewHome(
  catalogue: Catalogue,
  program: Program,
  homecomings: readonly Homecoming[],
): {
  entries: CrewHomeEntry[];
  awards: MilestoneAward[];
  lumps: { day: number; amount: number }[];
  publicSupport: number;
} {
  const each = catalogue.crew.publicSupportPerMemberHome;
  const home = homecomings
    .filter(({ names }) => names.length > 0)
    .toSorted((first, second) => first.day - second.day);
  const entries = home.map(({ names, day }): CrewHomeEntry => {
    const earned = each * names.length;
    return {
      kind: "crewHome",
      day,
      title: "Crew home",
      description: `${listOfNames.format(names)} ${names.length === 1 ? "is" : "are"} home safe, which earns ${earned} Public Support. They won't fly again.`,
    };
  });
  const [first] = home;
  const awards = first
    ? catalogue.milestones
        .filter(
          ({ id, trigger }) =>
            "crewComesHome" in trigger && !program.milestoneIds.includes(id),
        )
        .map((milestone) => ({ milestone, day: first.day }))
    : [];
  const lumps = home.map(({ names, day }) => ({
    day,
    amount: each * names.length,
  }));
  return {
    entries,
    awards,
    lumps,
    publicSupport: lumps.reduce((total, { amount }) => total + amount, 0),
  };
}
