import { describe, expect, it } from "vitest";
import { type TurnPlan, type TurnResult } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { skipTurn } from "./testHelpers";
import {
  scienceMilestone,
  simulationWith,
  researchingOrbiter,
} from "./scienceTestHelpers";

const fundingDays = ({ timeline }: TurnResult) =>
  timeline.entries
    .filter((entry) => entry.kind === "fundingThreshold")
    .map((entry) => [entry.title, entry.day]);

describe("a Funding Threshold crossed by a Science Milestone", () => {
  const thresholds = [{ publicSupport: 150, payoutMillions: 500 }];

  it("pays once, on the day of the award and after it, in a Turn with no Mission", () => {
    const { simulation, program } = simulationWith(
      [scienceMilestone(100, { publicSupport: 60 })],
      thresholds,
    );
    const result = simulation.runTurn({ ...program, science: 100 }, skipTurn);
    expect(result.timeline.mission).toBeNull();
    expect(
      result.timeline.entries.map(({ title, day }) => [title, day]),
    ).toEqual([
      ["100 Science", 0],
      ["Funding Threshold reached: 150 Public Support", 0],
    ]);
    expect(result.summary.fundingPayouts).toEqual(thresholds);
    expect(result.summary.moneyEndMillions).toBe(2500);
    // Being above it again pays nothing.
    const again = simulation.runTurn(
      { ...result.program, publicSupport: 200 },
      skipTurn,
    );
    expect(again.summary.fundingPayouts).toEqual([]);
    expect(fundingDays(again)).toEqual([]);
  });

  it("doesn't pay before the award, even after the Mission has arrived", () => {
    const { simulation, program } = simulationWith(
      // 100 + 200 on day 200, which doesn't reach it. The 40 on day 500 does.
      [scienceMilestone(130, { publicSupport: 40 })],
      [{ publicSupport: 355, payoutMillions: 500 }],
    );
    const result = simulation.runTurn(program, researchingOrbiter);
    // 15 from research by day 500.
    expect(fundingDays(result)).toEqual([
      ["Funding Threshold reached: 355 Public Support", 500],
    ]);
  });

  it("pays each threshold on its own day when one Turn crosses several", () => {
    const { simulation, program } = simulationWith(
      [scienceMilestone(130, { publicSupport: 40 })],
      [
        { publicSupport: 250, payoutMillions: 100 },
        { publicSupport: 310, payoutMillions: 200 },
        { publicSupport: 355, payoutMillions: 300 },
        { publicSupport: 365, payoutMillions: 400 },
        { publicSupport: 400, payoutMillions: 800 },
      ],
    );
    const result = simulation.runTurn(program, researchingOrbiter);
    expect(fundingDays(result)).toEqual([
      ["Funding Threshold reached: 250 Public Support", 200],
      // 300 on day 200, then 0.05 a day.
      ["Funding Threshold reached: 310 Public Support", 400],
      ["Funding Threshold reached: 355 Public Support", 500],
      // 355 on day 500, then 0.05 a day.
      ["Funding Threshold reached: 365 Public Support", 700],
    ]);
    expect(result.summary.moneyEndMillions).toBe(2000 - 500 + 1000);
  });
});

describe("a Funding Threshold crossed by Ongoing Research alone", () => {
  it("pays on the day the research reaches it, in a Turn with no Mission", () => {
    const { simulation, program } = simulationWith(
      [],
      [{ publicSupport: 340, payoutMillions: 1000 }],
    );
    const first = simulation.runTurn(program, researchingOrbiter);
    expect(first.summary.fundingPayouts).toEqual([]);
    const second = simulation.runTurn(
      { ...first.program, publicSupport: 330 },
      skipTurn,
    );
    expect(second.timeline.mission).toBeNull();
    // 10 more at 0.05 a day.
    expect(fundingDays(second)).toEqual([
      ["Funding Threshold reached: 340 Public Support", 200],
    ]);
    const third = simulation.runTurn(
      { ...second.program, publicSupport: 400 },
      skipTurn,
    );
    expect(third.summary.fundingPayouts).toEqual([]);
  });

  it("pays when Public Support last reaches it, if a failed Mission took it back below", () => {
    const files = testCatalogueFiles();
    const { simulation, program } = simulationWith(
      [],
      [{ publicSupport: 310, payoutMillions: 500 }],
      {
        ...files,
        missionEvents: files.missionEvents.map((event) =>
          event.id === "test-arrival"
            ? { ...event, failureProbability: 1 }
            : event,
        ),
      },
    );
    // An orbiter already doing research, for 0.05 Public Support a day.
    const earning = {
      ...program,
      publicSupport: 305,
      operatingAssets: [
        {
          assetId: "test-orbiter",
          name: "Test Orbiter",
          kind: "orbiter",
          arrivedOn: program.date,
          landingSiteId: null,
          serviceLifeDays: 50_000,
          reliabilityLevelId: "none",
          activityId: "test-research",
        },
      ],
    };
    const failing: TurnPlan = {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
    };
    const unpaid = simulation.runTurn(earning, failing);
    expect(unpaid.summary.failure).not.toBeNull();
    // Research passes 310 on day 100, but 305 + 39 - 40 ends the Turn short of it because the failure on day 200 costs 40.
    expect(unpaid.summary.fundingPayouts).toEqual([]);

    const paid = simulation.runTurn(
      { ...earning, publicSupport: 325 },
      failing,
    );
    // 325 passes 310 at once, but on day 200 it falls to 295 with the 10 from research, and is back 300 days later.
    expect(fundingDays(paid)).toEqual([
      ["Funding Threshold reached: 310 Public Support", 500],
    ]);
  });
});

describe("the next Funding Threshold", () => {
  const thresholds = [
    { publicSupport: 150, payoutMillions: 10 },
    { publicSupport: 300, payoutMillions: 20 },
    { publicSupport: 600, payoutMillions: 30 },
  ];

  it("moves through the list as each is paid, and then there is none", () => {
    const { simulation, program } = simulationWith([], thresholds);
    const next = (paid: number[]) =>
      simulation.readProgram({ ...program, fundingThresholdsPaid: paid })
        .nextFundingThreshold;
    expect(next([])?.publicSupport).toBe(150);
    expect(next([150])?.publicSupport).toBe(300);
    expect(next([150, 300])).toEqual({
      publicSupport: 600,
      payoutMillions: 30,
      pointsAway: 500,
    });
    expect(next([150, 300, 600])).toBeNull();
  });

  it("is no points away when Public Support is already above a level not yet paid", () => {
    const { simulation, program } = simulationWith([], thresholds);
    const view = simulation.readProgram({ ...program, publicSupport: 200 });
    expect(view.nextFundingThreshold).toEqual({
      publicSupport: 150,
      payoutMillions: 10,
      pointsAway: 0,
    });
  });

  it("pays straight away in a save above a level not yet paid", () => {
    const { simulation, program } = simulationWith([], thresholds);
    const result = simulation.runTurn(
      { ...program, publicSupport: 200 },
      skipTurn,
    );
    expect(fundingDays(result)).toEqual([
      ["Funding Threshold reached: 150 Public Support", 0],
    ]);
  });
});
