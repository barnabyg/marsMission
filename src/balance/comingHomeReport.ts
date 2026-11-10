import type { TurnRecord } from "./playProgram";
import type { Strategy } from "./strategy";
import { mean, percent, table, tenth } from "./reportFormat";
import { sum } from "./sum";

type Play = TurnRecord[];
type Results = { strategy: Strategy; plays: Play[] }[];

/** The fewest Turns a Program must play from a Turn on for it to count as keeping itself going from that Turn. */
const fewestTurnsKept = 3;

/** The money a Program makes for itself in a Turn: Research Grants and base funding, but no Funding Threshold. */
const ownIncome = ({
  researchGrantMillions,
  baseFundingMillions,
}: TurnRecord) => researchGrantMillions + baseFundingMillions;

/**
 * The first Turn, counted from 1, from which a Program keeps itself going, or null if it never does. It does from Turn
 * T if it isn't cancelled, plays at least three Turns from T on, launching at least one Mission in them, and from T to
 * every later Turn its Research Grants and base funding have paid for everything it spent: Missions, Development,
 * Upkeep and repaying a Bailout. It never needs the money it had before T, or a Funding Threshold, as those run out.
 */
export function keepsItselfGoingFrom(play: Play): number | null {
  if (play.at(-1)?.cancelled !== false) return null;
  const paysItsWay = (from: number) => {
    let balance = 0;
    for (const turn of play.slice(from)) {
      balance +=
        ownIncome(turn) - turn.spentMillions - turn.bailoutRepaidMillions;
      if (balance < 0) return false;
    }
    return play.slice(from).some(({ launched }) => launched);
  };
  for (let from = 0; from <= play.length - fewestTurnsKept; from++) {
    if (paysItsWay(from)) return from + 1;
  }
  return null;
}

/** The causes of Crew lost on the way home that any strategy met, in a fixed order. */
function lossCauses(results: Results): string[] {
  return [
    ...new Set(
      results.flatMap(({ plays }) =>
        plays
          .flat()
          .flatMap(({ crewLostOnWayHome }) => Object.keys(crewLostOnWayHome)),
      ),
    ),
  ].toSorted();
}

/** Each strategy that brought anything home or lost it on the way: Crew by how they came home, the Crew lost and samples. */
function homecomings(results: Results): string[] {
  const causes = lossCauses(results);
  const rows = results.flatMap(({ strategy, plays }) => {
    const turns = plays.flat();
    const perProgram = (read: (turn: TurnRecord) => number) =>
      sum(turns.map(read)) / plays.length;
    const counts = [
      perProgram(({ crewHomeBy }) => crewHomeBy.roundTrip),
      perProgram(({ crewHomeBy }) => crewHomeBy.fetched),
      perProgram(({ crewHomeBy }) => crewHomeBy.freeReturn),
      ...causes.map((cause) =>
        perProgram(({ crewLostOnWayHome }) => crewLostOnWayHome[cause] ?? 0),
      ),
      perProgram(({ samplesHome }) => samplesHome),
      perProgram(({ samplesLost }) => samplesLost),
    ];
    if (counts.every((count) => count === 0)) return [];
    return [[strategy.name, ...counts.map(tenth)]];
  });
  if (rows.length === 0) return ["Coming home: nothing came home"];
  return table(
    [
      "Strategy",
      "RoundTrip",
      "Fetched",
      "FreeReturn",
      ...causes.map((cause) => `Lost:${cause.replaceAll(" ", "")}`),
      "Samples",
      "SamplesLost",
    ],
    rows,
  );
}

/** For each strategy, how many Programs keep themselves going, and from which Turn. */
function keepingGoing(results: Results): string[] {
  return table(
    ["Strategy", "Kept%", "FromTurn", "Earliest"],
    results.map(({ strategy, plays }) => {
      const from = plays.flatMap((play) => keepsItselfGoingFrom(play) ?? []);
      return [
        strategy.name,
        percent(from.length, plays.length),
        from.length > 0 ? tenth(mean(from)) : "-",
        from.length > 0 ? String(Math.min(...from)) : "-",
      ];
    }),
  );
}

/**
 * The report's Coming Home section: Crew brought home, by round trip, fetching and Free-return, Crew lost on the way
 * home by cause, samples returned, and how many Programs keep themselves going, and from which Turn.
 */
export function comingHome(results: Results): string[] {
  return [
    "Means per Program of Crew home safe after a round trip (RoundTrip), after a return vehicle fetched them (Fetched) and",
    "on a Free-return (FreeReturn), Crew lost on their journey home (Lost:), by the Mission Event that failed or by Health",
    "or Supplies running out on the way, then samples that reached Earth (Samples) and samples lost on the way home",
    "(SamplesLost), for every strategy that brought anything home or lost it on the way.",
    "",
    ...homecomings(results),
    "",
    `A Program keeps itself going from Turn T if it isn't cancelled, plays at least ${fewestTurnsKept} Turns from T on, launching at least`,
    "one Mission in them, and from T to every later Turn its Research Grants and base funding have paid for everything it",
    "spent: Missions, Development and Upkeep. It never needs money it had before T, or a Funding Threshold.",
    "Kept% of Programs keep themselves going, FromTurn is the mean Turn they start to and Earliest the first.",
    "",
    ...keepingGoing(results),
  ];
}
