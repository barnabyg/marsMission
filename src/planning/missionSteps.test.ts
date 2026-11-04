import { describe, expect, it } from "vitest";
import { missionSteps } from "./missionSteps";

const robotic = { nothingTicked: false, landsOnMars: false };

describe("the New Mission steps", () => {
  it("are numbered in the order a player plans a Mission", () => {
    expect(
      missionSteps(robotic).map(({ number, title }) => `${number}. ${title}`),
    ).toEqual([
      "1. Launch Vehicle and Trajectory",
      "2. Assets and Crew",
      "3. Landing Site",
      "4. Mission Events, Reliability and Contingency",
    ]);
  });

  it("each say what they decide", () => {
    for (const step of missionSteps(robotic)) {
      expect(step.note).not.toBe("");
    }
  });

  it("keep the Landing Site closed, saying why, while nothing on the Mission lands", () => {
    const landingSite = missionSteps(robotic)[2];
    expect(landingSite?.collapsedBecause).toBe(
      "Opens when the Mission carries a lander, a rover or Crew who land.",
    );
  });

  it("open the Landing Site as soon as something on the Mission lands", () => {
    const landingSite = missionSteps({ ...robotic, landsOnMars: true })[2];
    expect(landingSite?.collapsedBecause).toBeNull();
  });

  it("keep the Mission Events closed, saying why, while nothing is ticked", () => {
    const events = missionSteps({ ...robotic, nothingTicked: true })[3];
    expect(events?.collapsedBecause).toBe(
      "Opens once the Mission carries an Asset or Crew.",
    );
  });

  it("open the Mission Events once something is ticked", () => {
    expect(missionSteps(robotic)[3]?.collapsedBecause).toBeNull();
  });

  it("never close the Launch Vehicle or the Assets and Crew", () => {
    const [launch, assets] = missionSteps({
      nothingTicked: true,
      landsOnMars: false,
    });
    expect(launch?.collapsedBecause).toBeNull();
    expect(assets?.collapsedBecause).toBeNull();
  });
});
