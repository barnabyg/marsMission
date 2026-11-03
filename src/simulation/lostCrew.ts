import type { Catalogue } from "../catalogue/catalogue";
import { addDays } from "./rules";
import type { CrewLostEntry } from "./timeline";
import type { TurnSummary } from "./turnSummary";
import type { CrewLossCause, CrewMember, Program } from "./types";

/**
 * Crew who leave for good: lost, or brought home by a Free-return. Whatever loses Crew, on the way to Mars or at Mars,
 * gives a `CrewLoss` for the Turn, and `loseCrew` works out what losing them costs, the same for every cause.
 */

/** Crew lost together on one day of a Turn, for one cause. */
export interface CrewLoss {
  names: string[];
  day: number;
  cause: CrewLossCause;
  /** What lost them, to end a sentence such as "Ann Able was lost", for example "when Launch failed". */
  how: string;
}

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** The loss of these Crew on this day for this cause, or none if there are no Crew. */
export function crewLoss(
  names: string[],
  day: number,
  cause: CrewLossCause,
  how: string,
): CrewLoss[] {
  return names.length > 0 ? [{ names, day, cause, how }] : [];
}

/** The Public Support that losing this many Crew costs, before it is held at what the Program has left. */
const crewLossCost = (catalogue: Catalogue, members: number) =>
  catalogue.crew.publicSupportLossPerMember * members;

/** What a Decision Point adds about losing these Crew, if any are at stake. */
export const crewLossWarning = (catalogue: Catalogue, names: string[]) =>
  names.length > 0
    ? ` Losing the Crew costs ${crewLossCost(catalogue, names.length)} Public Support more.`
    : "";

/**
 * Loses these Crew, each group on its day for its cause. It records them as lost, so they never operate, earn or fly
 * again and their names aren't given again, and takes the large drop in Public Support that losing Crew costs for each
 * of them, on top of anything else that day costs. Each drop comes out of the Public Support left after the ones
 * before, starting from what's left after the Turn's other losses, so it never takes Public Support below zero.
 */
export function loseCrew(
  catalogue: Catalogue,
  program: Program,
  losses: readonly CrewLoss[],
  publicSupportLeft: number,
  /** The Protection of the Turn's Mission, for its Crew, who aren't on record yet. */
  protectionId: string,
): {
  /** Their records as lost, keeping the day they arrived at Mars if they did. */
  lost: CrewMember[];
  entries: CrewLostEntry[];
  summary: TurnSummary["crewLost"];
  /** What each loss cost on its day, for the Turn's Public Support as it goes. */
  lumps: { day: number; amount: number }[];
  publicSupportLost: number;
} {
  let left = publicSupportLeft;
  const each = losses
    .toSorted((first, second) => first.day - second.day)
    .map(({ names, day, cause, how }) => {
      const publicSupportLost = Math.min(
        crewLossCost(catalogue, names.length),
        left,
      );
      left -= publicSupportLost;
      const lostOn = addDays(program.date, day);
      const lost = names.map((name): CrewMember => {
        const before = program.crew.find((member) => member.name === name);
        return {
          name,
          health: 0,
          arrivedOn: before?.arrivedOn ?? null,
          location: { kind: "lost", lostOn, cause },
          protectionId: before?.protectionId ?? protectionId,
        };
      });
      const [only] = names;
      const description = `${listOfNames.format(names)} ${names.length === 1 ? "was" : "were"} lost ${how}.`;
      const entry: CrewLostEntry = {
        kind: "crewLost",
        day,
        title: names.length === 1 && only ? `${only} lost` : "Crew lost",
        description: `${description} Losing Crew costs ${publicSupportLost} Public Support.`,
      };
      return {
        lost,
        entry,
        summary: { names, cause, description, publicSupportLost },
      };
    });
  return {
    lost: each.flatMap(({ lost }) => lost),
    entries: each.map(({ entry }) => entry),
    summary: each.map(({ summary }) => summary),
    lumps: each.map(({ entry, summary }) => ({
      day: entry.day,
      amount: -summary.publicSupportLost,
    })),
    publicSupportLost: publicSupportLeft - left,
  };
}

/**
 * The records of Crew a Free-return brought back to Earth on this day of the Turn, with the Health they have left and
 * their Mission's Protection. They never fly again.
 */
export function bringCrewHome(
  program: Program,
  crew: readonly { name: string; health: number }[],
  backOnDay: number,
  protectionId: string,
): CrewMember[] {
  const backOn = addDays(program.date, backOnDay);
  return crew.map(({ name, health }) => ({
    name,
    health,
    arrivedOn: null,
    location: { kind: "home", backOn },
    protectionId,
  }));
}

/**
 * The Program's Crew with these changed or new: each one already listed keeps its place, and new ones go at the end.
 * A Crew member changed more than once, such as one who arrived and then died, ends as the last change says.
 */
export function withCrew(
  crew: readonly CrewMember[],
  changed: readonly CrewMember[],
): CrewMember[] {
  const byName = new Map(changed.map((member) => [member.name, member]));
  const listed = new Set(crew.map(({ name }) => name));
  const added = [...new Set(changed.map(({ name }) => name))].filter(
    (name) => !listed.has(name),
  );
  return [
    ...crew.map((member) => byName.get(member.name) ?? member),
    ...added.flatMap((name) => byName.get(name) ?? []),
  ];
}
