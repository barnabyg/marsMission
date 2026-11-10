import type { TurnRecord } from "./playProgram";
import { mean, percent, tenth, whole } from "./reportFormat";

type Play = TurnRecord[];

/**
 * How often a strategy took the Bailout, for how much and on which Turn, and how those Programs ended: whether they
 * were cancelled, and with how much Money, which is below zero while repayments outrun income.
 */
export function bailoutLines(plays: Play[]): string[] {
  const taken = plays.flatMap((play) => {
    const index = play.findIndex((turn) => turn.bailoutTakenMillions > 0);
    const turn = play[index];
    return turn
      ? [{ play, turn: index + 1, millions: turn.bailoutTakenMillions }]
      : [];
  });
  if (taken.length === 0) return ["Bailout taken: never"];
  const last = taken.flatMap(({ play }) => play.at(-1) ?? []);
  const cancelled = last.filter((turn) => turn.cancelled);
  const belowZero = taken.filter(({ play }) =>
    play.some((turn) => turn.moneyMillions < 0),
  );
  return [
    `Bailout taken: ${percent(taken.length, plays.length)}% of Programs, for $${whole(mean(taken.map(({ millions }) => millions)))}M on average, on Turn ${tenth(mean(taken.map(({ turn }) => turn)))}`,
    `  Of those: ${percent(cancelled.length, taken.length)}% cancelled, ${percent(belowZero.length, taken.length)}% had Money below zero, ending with $${whole(mean(last.map((turn) => turn.moneyMillions)))}M`,
  ];
}
