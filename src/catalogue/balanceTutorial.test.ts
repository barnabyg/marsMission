import { describe, expect, it } from "vitest";
import { cantRecoverOn, goalReachedOn } from "../balance/goalReport";
import { played } from "../testing/playedStrategies";
import { tutorialName } from "../tutorial/tutorial";

describe("the balance of the tutorial's route to Crew at a Base", () => {
  const { plays } = played(tutorialName);
  const reached = plays.filter((play) => goalReachedOn(play) !== null);
  const gaveUp = plays.filter((play) => cantRecoverOn(play) !== null);

  it("lands Crew at a Base in most Programs that follow its advice, within 20 Turns", () => {
    expect(reached.length / plays.length).toBeGreaterThan(0.7);
  });

  it("rarely gives up on a Program that would have reached a Base", () => {
    const wrongly = gaveUp.filter((play) => goalReachedOn(play) !== null);
    expect(wrongly.length / plays.length).toBeLessThan(0.01);
    // It does give up on some, which would otherwise be left with advice that can't work.
    expect(gaveUp.length).toBeGreaterThan(0);
  });
});
