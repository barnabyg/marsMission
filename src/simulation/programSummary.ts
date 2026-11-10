import type { Catalogue } from "../catalogue/catalogue";
import { bailoutOwed } from "./bailout";
import type { TurnSummary } from "./turnSummary";
import type { Program, ProgramView } from "./types";

/** What a Program has done over its Turns that its state doesn't show by itself, kept for its summary. */
export interface ProgramRecord {
  /** The first Turn counted: 1, or the Turn a save made before the record was kept was on when it was loaded. */
  countedFromTurn: number;
  missionsLaunched: number;
  /** The Missions a failed Mission Event or a Hazard ended, a Free-return's included. */
  missionsLost: number;
  /** The highest Public Support the Program has had at the start or end of a Turn. */
  peakPublicSupport: number;
  /** The samples that reached Earth. */
  samplesHome: number;
  /** The Turn each Milestone was earned on, by its id. */
  milestoneTurns: Record<string, number>;
}

/** How a Program went, from its first Turn to its end. */
export interface ProgramSummary {
  status: ProgramView["status"];
  /** The seed it was played with, so that it can be played again. */
  seed: number;
  turnsPlayed: number;
  /** The years those Turns took, to the nearest whole year. */
  years: number;
  missionsLaunched: number;
  missionsLost: number;
  science: number;
  peakPublicSupport: number;
  moneyMillions: number;
  /** In the order they were earned, with the Turn each was, or null if it was earned before countedFromTurn. */
  milestones: {
    name: string;
    description: string;
    science: number;
    publicSupport: number;
    turn: number | null;
  }[];
  crew: { flown: number; home: number; lost: number };
  samplesHome: number;
  /** The Bailout, if it was taken: on which Turn, for how much, and what was still owed as the Program ended. */
  bailout: { onTurn: number; millions: number; owedMillions: number } | null;
  /** The first Turn the Missions, peak Public Support, samples and Milestones' Turns count from: 1 unless the Program was saved by an earlier version. */
  countedFromTurn: number;
}

export function newRecord(
  countedFromTurn: number,
  publicSupport: number,
): ProgramRecord {
  return {
    countedFromTurn,
    missionsLaunched: 0,
    missionsLost: 0,
    peakPublicSupport: publicSupport,
    samplesHome: 0,
    milestoneTurns: {},
  };
}

/** The record with one more Turn: the one that took `before` to `after`, flying `launched` and ending as `summary` says. */
export function recordTurn(
  before: Program,
  after: Program,
  launched: boolean,
  summary: TurnSummary,
): ProgramRecord {
  const { record } = before;
  const earned = after.milestoneIds.filter(
    (id) => !before.milestoneIds.includes(id),
  );
  return {
    ...record,
    missionsLaunched: record.missionsLaunched + (launched ? 1 : 0),
    missionsLost: record.missionsLost + (summary.failure ? 1 : 0),
    peakPublicSupport: Math.max(
      record.peakPublicSupport,
      summary.publicSupportEnd,
    ),
    samplesHome:
      record.samplesHome +
      summary.samplesHome.reduce((sum, { samples }) => sum + samples, 0),
    milestoneTurns: {
      ...record.milestoneTurns,
      ...Object.fromEntries(earned.map((id) => [id, before.turnNumber])),
    },
  };
}

const daysInYear = 365.25;

export function programSummary(
  catalogue: Catalogue,
  program: Program,
): ProgramSummary {
  const { record, crew } = program;
  const turnsPlayed = program.turnNumber - 1;
  return {
    status: program.status,
    seed: program.seed,
    turnsPlayed,
    years: Math.round(
      (turnsPlayed * catalogue.program.launchWindowIntervalDays) / daysInYear,
    ),
    missionsLaunched: record.missionsLaunched,
    missionsLost: record.missionsLost,
    science: program.science,
    peakPublicSupport: record.peakPublicSupport,
    moneyMillions: program.moneyMillions,
    milestones: program.milestoneIds.flatMap((id) =>
      catalogue.milestones
        .filter((milestone) => milestone.id === id)
        .map(({ name, description, science, publicSupport }) => ({
          name,
          description,
          science,
          publicSupport,
          turn: record.milestoneTurns[id] ?? null,
        })),
    ),
    crew: {
      flown: crew.length,
      home: crew.filter(({ location }) => location.kind === "home").length,
      lost: crew.filter(({ location }) => location.kind === "lost").length,
    },
    samplesHome: record.samplesHome,
    bailout:
      program.bailout.kind === "taken"
        ? {
            onTurn: program.bailout.onTurn,
            millions: program.bailout.millions,
            owedMillions: bailoutOwed(program.bailout),
          }
        : null,
    countedFromTurn: record.countedFromTurn,
  };
}
