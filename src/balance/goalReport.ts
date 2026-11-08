import type { TurnRecord } from "./playProgram";
import { mean, percent, tenth } from "./reportFormat";

type Play = TurnRecord[];

/** The Turn, counted from 1, at whose end a Program first reached its strategy's goal, or null if it never did. */
export function goalReachedOn(play: Play): number | null {
  const index = play.findIndex(({ goal }) => goal?.reached === true);
  return index < 0 ? null : index + 1;
}

/**
 * The Turn, counted from 1, at whose end the strategy first judged a Program unable to reach its goal before reaching
 * it, or null if it never did. Programs play on after it, to see whether any reach the goal anyway.
 */
export function cantRecoverOn(play: Play): number | null {
  const reached = goalReachedOn(play) ?? Infinity;
  const index = play.findIndex(
    ({ goal }, turn) => goal?.cantRecover === true && turn + 1 < reached,
  );
  return index < 0 ? null : index + 1;
}

const median = (values: number[]) => {
  const sorted = values.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/**
 * The lines of a strategy's section on its goal: how often it is reached and by which Turn, how often the strategy
 * judges a Program unable to reach it, and how often that judgement was wrong. Nothing for a strategy with no goal.
 */
export function goalLines(plays: Play[]): string[] {
  if (!plays.some((play) => play.some(({ goal }) => goal !== undefined))) {
    return [];
  }
  const reached = plays.flatMap((play) => goalReachedOn(play) ?? []);
  const fired = plays.filter((play) => cantRecoverOn(play) !== null);
  const firedOn = fired.flatMap((play) => cantRecoverOn(play) ?? []);
  const wrong = fired.filter((play) => goalReachedOn(play) !== null);
  return [
    `Goal reached: ${percent(reached.length, plays.length)}% of Programs` +
      (reached.length > 0
        ? `, at the end of Turn ${tenth(mean(reached))} on average (median ${tenth(median(reached))})`
        : ""),
    `Can't recover: ${percent(fired.length, plays.length)}% of Programs` +
      (fired.length > 0
        ? `, at the end of Turn ${tenth(mean(firedOn))} on average, ` +
          `${percent(wrong.length, fired.length)}% of those reaching the goal anyway (${wrong.length} Programs)`
        : ""),
  ];
}
