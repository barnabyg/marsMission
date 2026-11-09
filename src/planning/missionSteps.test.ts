import { describe, expect, it } from "vitest";
import { launchSummary, missionSteps } from "./missionSteps";

const robotic = {
  nothingTicked: false,
  landsOnMars: false,
  launch: {
    summary: "Meridian Medium (4 t) · Slow (210 days)",
    changing: false,
  },
};

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
      ...robotic,
      nothingTicked: true,
    });
    expect(launch?.collapsedBecause).toBeNull();
    expect(assets?.collapsedBecause).toBeNull();
  });
});

describe("the Launch Vehicle and Trajectory step, once something is ticked", () => {
  const launch = {
    summary: "Meridian Medium (4 t) · Slow (210 days)",
    changing: false,
  };

  it("stays open while nothing is ticked, whatever was chosen", () => {
    expect(
      missionSteps({ nothingTicked: true, landsOnMars: false, launch })[0]
        ?.summary,
    ).toBeNull();
  });

  it("folds to one line saying what was chosen once something is ticked", () => {
    expect(missionSteps({ ...robotic, launch })[0]?.summary).toBe(
      "Meridian Medium (4 t) · Slow (210 days)",
    );
  });

  it("opens again while the player is changing it", () => {
    expect(
      missionSteps({ ...robotic, launch: { ...launch, changing: true } })[0]
        ?.summary,
    ).toBeNull();
  });

  it("never folds the other steps", () => {
    for (const step of missionSteps({ ...robotic, launch }).slice(1)) {
      expect(step.summary).toBeNull();
    }
  });
});

describe("the one line a folded Launch Vehicle and Trajectory step says", () => {
  it("names the Launch Vehicle with what it carries, and the Trajectory with its days", () => {
    expect(
      launchSummary(
        { name: "Meridian Medium", capacityTonnes: 4 },
        { name: "Slow", transferDays: 210 },
      ),
    ).toBe("Meridian Medium (4 t) · Slow (210 days)");
  });

  it("names the Launch Vehicle alone while no Trajectory is chosen", () => {
    expect(
      launchSummary({ name: "Meridian Medium", capacityTonnes: 4 }, undefined),
    ).toBe("Meridian Medium (4 t)");
  });
});
