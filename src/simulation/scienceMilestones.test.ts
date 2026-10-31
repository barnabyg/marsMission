import { describe, expect, it } from "vitest";
import { type TurnResult } from "./simulation";
import { safeLandingFiles, skipTurn } from "./testHelpers";
import {
  scienceMilestone,
  simulationWith,
  researchingOrbiter,
} from "./scienceTestHelpers";

const milestoneDays = ({ timeline }: TurnResult) =>
  timeline.entries
    .filter((entry) => entry.kind === "milestone")
    .map((entry) => [entry.title, entry.day]);

describe("a Science Milestone", () => {
  it("is awarded on the day Ongoing Research reaches its total, with what it awards in the events column", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(130, { science: 5, publicSupport: 7 }),
    ]);
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(milestoneDays(result)).toEqual([
      ["First orbiter", 200],
      // 100 on day 200, then 30 more at 0.1 a day.
      ["130 Science", 500],
    ]);
    expect(
      result.timeline.entries.find(({ title }) => title === "130 Science")
        ?.description,
    ).toBe("A lot of Science. It awards 5 Science and 7 Public Support.");
    expect(result.summary.milestones).toContainEqual({
      name: "130 Science",
      science: 5,
      publicSupport: 7,
    });
    // 100, the 58 earned in 580 days, and the 5.
    expect(result.summary.scienceGained).toBe(163);
    // 200, the 29 earned in 580 days, and the 7.
    expect(result.summary.publicSupportGained).toBe(236);
    const view = simulation.readProgram(result.program);
    expect(view.science).toBe(163);
    expect(view.milestones.map(({ name }) => name)).toEqual([
      "First orbiter",
      "130 Science",
    ]);
  });

  it("isn't awarded while the total is still short of it", () => {
    const { simulation, program } = simulationWith([scienceMilestone(159)]);
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(milestoneDays(result)).toEqual([["First orbiter", 200]]);
    expect(simulation.readProgram(result.program).milestones).toHaveLength(1);
  });

  it("is awarded after the arrival Milestone whose Science reached it", () => {
    const { simulation, program } = simulationWith([scienceMilestone(100)]);
    const { timeline } = simulation.runTurn(program, researchingOrbiter);
    const titles = timeline.entries
      .filter(({ day }) => day === 200)
      .map(({ title }) => title);
    expect(titles).toEqual([
      "Test arrival",
      "First orbiter",
      "100 Science",
      "Funding Threshold reached: 300 Public Support",
    ]);
  });

  it("counts the Science of a first landing, and comes after it in the events column", () => {
    const { simulation, program } = simulationWith(
      // First landing's 40 and Alpha Plain's 50.
      [scienceMilestone(90)],
      undefined,
      safeLandingFiles(),
    );
    const { timeline } = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
      },
    });
    expect(
      timeline.entries
        .filter(({ day }) => day === 205)
        .map(({ title }) => title),
    ).toEqual([
      "Test landing",
      "First landing",
      "First landing at Alpha Plain",
      "90 Science",
    ]);
  });

  it("counts Science from earlier Turns", () => {
    const { simulation, program } = simulationWith([scienceMilestone(160)]);
    const first = simulation.runTurn(program, researchingOrbiter);
    const second = simulation.runTurn(first.program, skipTurn);
    // 158 after the first Turn, so 2 more at 0.1 a day.
    expect(milestoneDays(second)).toEqual([["160 Science", 20]]);
  });

  it("is reached exactly on the day an Asset's Science makes the total, from several Assets", () => {
    const { simulation, program } = simulationWith([scienceMilestone(200)]);
    const first = simulation.runTurn(program, researchingOrbiter);
    const second = simulation.runTurn(first.program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter"],
        assetChoices: { "test-orbiter": { activityId: "test-research" } },
      },
    });
    // 158 after the first Turn. 0.1 a day to day 200 makes 178, and then 0.2 a day for the other 22.
    expect(milestoneDays(second)).toEqual([["200 Science", 310]]);
  });

  it("is awarded when the Asset stops, if only the rounding up of its Science reaches it", () => {
    const files = safeLandingFiles();
    const { simulation, program } = simulationWith(
      // First landing's 40, Alpha Plain's 50, and the 31 for 305 days, which is 30.5 rounded up.
      [scienceMilestone(121)],
      undefined,
      {
        ...files,
        assets: files.assets.map((asset) =>
          asset.id === "test-lander"
            ? {
                ...asset,
                serviceLifeOptions: [{ days: 305, costMillions: 0 }],
                activities: ["test-research", "test-nothing"],
              }
            : asset,
        ),
      },
    );
    const result = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
      },
    });
    expect(result.summary.scienceGained).toBe(121);
    // It lands on day 205 and stops 305 days later.
    expect(milestoneDays(result)).toContainEqual(["121 Science", 510]);
  });

  it("is awarded on the Turn's last day, and never later, if the rounding reaches it only as the Turn ends", () => {
    const files = safeLandingFiles();
    const { simulation, program } = simulationWith(
      // 40 and 50, and the 58 for 575 days, which is 57.5 rounded up.
      [scienceMilestone(148)],
      undefined,
      {
        ...files,
        assets: files.assets.map((asset) =>
          asset.id === "test-lander"
            ? { ...asset, activities: ["test-research", "test-nothing"] }
            : asset,
        ),
      },
    );
    const result = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-lander"],
        landingSiteId: "alpha-plain",
      },
    });
    expect(result.summary.scienceGained).toBe(148);
    expect(milestoneDays(result)).toContainEqual([
      "148 Science",
      result.timeline.durationDays - 1,
    ]);
  });

  it("is awarded on the first day of the first Turn in a save already past it", () => {
    const { simulation, program } = simulationWith([scienceMilestone(100)]);
    const result = simulation.runTurn({ ...program, science: 500 }, skipTurn);
    expect(milestoneDays(result)).toEqual([["100 Science", 0]]);
    expect(milestoneDays(simulation.runTurn(result.program, skipTurn))).toEqual(
      [],
    );
  });

  it("isn't awarded again in a save that already has it", () => {
    const { simulation, program } = simulationWith([scienceMilestone(100)]);
    const { summary } = simulation.runTurn(
      { ...program, science: 500, milestoneIds: ["science-100"] },
      skipTurn,
    );
    expect(summary.milestones).toEqual([]);
    expect(summary.scienceGained).toBe(0);
  });

  it("is awarded in a Turn that cancels the Program, and its Science stays", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(100, { science: 25 }),
    ]);
    const {
      summary,
      timeline,
      program: after,
    } = simulation.runTurn(
      { ...program, publicSupport: 55, science: 100 },
      skipTurn,
    );
    expect(summary.cancellationReason).not.toBeNull();
    expect(timeline.entries.map(({ title }) => title)).toEqual(["100 Science"]);
    const view = simulation.readProgram(after);
    expect(view.status.kind).toBe("cancelled");
    expect(view.science).toBe(125);
    expect(view.milestones.map(({ name }) => name)).toEqual(["100 Science"]);
  });

  it("can save a Program from cancellation with its Public Support, as other Milestones can", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(100, { publicSupport: 10 }),
    ]);
    const { program: after } = simulation.runTurn(
      { ...program, publicSupport: 55, science: 100 },
      skipTurn,
    );
    // 65 drains to 55, which is above the Cancellation Level of 50.
    const view = simulation.readProgram(after);
    expect(view.status.kind).toBe("active");
    expect(view.publicSupport).toBe(55);
  });
});

describe("Science earned from a Science Milestone", () => {
  it("can reach the next one on the same day, and each is awarded once", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(100, { science: 50 }),
      scienceMilestone(150, { science: 10 }),
      scienceMilestone(170),
    ]);
    const first = simulation.runTurn(program, researchingOrbiter);
    expect(milestoneDays(first)).toEqual([
      ["First orbiter", 200],
      ["100 Science", 200],
      ["150 Science", 200],
      // 160 on day 200, then 10 more at 0.1 a day.
      ["170 Science", 300],
    ]);
    // 100, 50 and 10, and the 58 from research.
    expect(first.summary.scienceGained).toBe(218);
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary.milestones).toEqual([]);
    expect(second.summary.scienceGained).toBe(78);
  });

  it("counts only from the day it's awarded", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(130, { science: 50 }),
      scienceMilestone(185),
    ]);
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(milestoneDays(result)).toEqual([
      ["First orbiter", 200],
      // 130 on day 500, which the 50 takes to 180, and then 5 more at 0.1 a day.
      ["130 Science", 500],
      ["185 Science", 550],
    ]);
  });

  it("gives the same awards whatever order the data file lists them in", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(185),
      scienceMilestone(130, { science: 50 }),
    ]);
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(milestoneDays(result)).toEqual([
      ["First orbiter", 200],
      ["130 Science", 500],
      ["185 Science", 550],
    ]);
  });

  it("doesn't award one that the Turn's Science falls short of", () => {
    const { simulation, program } = simulationWith([
      scienceMilestone(130, { science: 50 }),
      // The Turn ends on 208.
      scienceMilestone(209),
    ]);
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(result.summary.scienceGained).toBe(208);
    expect(milestoneDays(result).map(([title]) => title)).not.toContain(
      "209 Science",
    );
    // It's reached by the next Turn's research.
    expect(milestoneDays(simulation.runTurn(result.program, skipTurn))).toEqual(
      [["209 Science", 10]],
    );
  });
});
