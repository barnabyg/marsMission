import { playProgram, type TurnRecord } from "../balance/playProgram";
import { strategies } from "../balance/strategies";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import { files } from "./realBalance";

/** How many Programs each strategy plays in the tests of the tuned balance. */
const programs = 300;

const real = createSimulation(parseCatalogue(files));
const meanOf = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

function play(name: string) {
  const strategy = strategies.find((candidate) => candidate.name === name);
  if (!strategy) throw new Error(`Expected the strategy "${name}"`);
  const plays = Array.from(
    { length: programs },
    (_, index) => playProgram(real, strategy, index + 1, 20).turns,
  );
  const ends = (read: (turn: TurnRecord) => number) =>
    meanOf(plays.flatMap((play) => play.at(-1) ?? []).map(read));
  const firstReached = (level: number) =>
    meanOf(
      plays.flatMap((play) => {
        const index = play.findIndex(({ thresholdsReached }) =>
          thresholdsReached.includes(level),
        );
        return index < 0 ? [] : [index + 1];
      }),
    );
  return {
    plays,
    science: ends(({ science }) => science),
    money: ends(({ moneyMillions }) => moneyMillions),
    cancelled: ends(({ cancelled }) => Number(cancelled)),
    firstReached,
    /** The income from each source over these Turns, counted from 1. */
    income(turnNumbers: number[]) {
      const turns = plays.flatMap((play) =>
        turnNumbers.flatMap((number) => play[number - 1] ?? []),
      );
      const total = (read: (turn: TurnRecord) => number) =>
        turns.reduce((sum, turn) => sum + read(turn), 0);
      return {
        thresholds: total(({ thresholdMillions }) => thresholdMillions),
        grants: total(({ researchGrantMillions }) => researchGrantMillions),
      };
    },
  };
}

const playedByName = new Map<string, ReturnType<typeof play>>();

/**
 * Means over many seeds of a strategy from the balance runs on the real data files, so that the tests of the tuned
 * balance read like the balance report. Each strategy is played once, however many tests ask for it.
 */
export function played(name: string): ReturnType<typeof play> {
  const known = playedByName.get(name);
  if (known) return known;
  const result = play(name);
  playedByName.set(name, result);
  return result;
}
