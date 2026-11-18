import { describe, expect, it } from "vitest";
import {
  cantRecoverOn,
  goalLines,
  goalReachedOn,
  goalSummary,
} from "./goalReport";
import { playProgram, type TurnRecord } from "./playProgram";
import { launchNothing, real } from "./testHelpers";

/** A Program's Turns that only say how its goal stood at the end of each, from the end of Turn 1 on. */
function playWith(goal: { reached: boolean; cantRecover: boolean }[]) {
  const [turn] = playProgram(real, launchNothing, 1, 1).turns;
  if (!turn) throw new Error("Expected a Turn");
  return goal.map((each): TurnRecord => ({ ...turn, goal: each }));
}

const going = { reached: false, cantRecover: false };
const reached = { reached: true, cantRecover: false };
const stuck = { reached: false, cantRecover: true };

describe("a strategy's goal in the report", () => {
  it("leaves the lines out for a strategy with no goal", () => {
    expect(goalLines([playProgram(real, launchNothing, 1, 3).turns])).toEqual(
      [],
    );
  });

  it("counts the first Turn a Program reached its goal, and when it was given up on before that", () => {
    const late = playWith([going, stuck, going, reached]);
    expect(goalReachedOn(late)).toBe(4);
    expect(cantRecoverOn(late)).toBe(2);
    expect(cantRecoverOn(playWith([reached, stuck]))).toBeNull();
    expect(goalReachedOn(playWith([stuck, stuck]))).toBeNull();
  });

  it("reports how often the goal was reached, and how often giving up was wrong", () => {
    const plays = [
      playWith([going, reached]),
      playWith([reached]),
      playWith([stuck, going, reached]),
      playWith([going, stuck, stuck]),
    ];
    expect(goalLines(plays)).toEqual([
      "Goal reached: 75.0% of Programs, at the end of Turn 2.0 on average (median 2.0)",
      "Can't recover: 50.0% of Programs, at the end of Turn 1.5 on average, 50.0% of those reaching the goal anyway (1 Programs)",
    ]);
  });
});

describe("goal summary for gameBench", () => {
  it("counts every attempt, taking the median only over successful Programs", () => {
    const plays = [
      playWith([reached]),
      playWith([stuck, stuck]),
      playWith([going, going, going, reached]),
    ];
    expect(goalSummary(plays)).toEqual({
      attempts: 3,
      completed: 2,
      meanTurn: 2.5,
      medianTurn: 2.5,
    });
  });

  it("has no median when every Program misses its goal", () => {
    expect(goalSummary([playWith([going]), playWith([stuck])])).toEqual({
      attempts: 2,
      completed: 0,
      meanTurn: 0,
      medianTurn: null,
    });
  });
});
