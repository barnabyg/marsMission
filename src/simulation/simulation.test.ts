import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogue, testCatalogueFiles } from "./testCatalogue";

const sendOrbiter: TurnPlan = {
  mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
};

function setup() {
  const simulation = createSimulation(testCatalogue());
  return { simulation, program: simulation.startProgram(42) };
}

describe("starting a Program", () => {
  it("begins at the first Launch Window with the catalogue's money and Public Support", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.turnNumber).toBe(1);
    expect(view.date).toBe("2028-12-01");
    expect(view.moneyMillions).toBe(2000);
    expect(view.publicSupport).toBe(100);
    expect(view.operatingAssets).toEqual([]);
  });

  it("offers the catalogue's Launch Vehicles and Assets", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.launchVehicles.map((vehicle) => vehicle.id)).toEqual([
      "test-vehicle",
    ]);
    expect(view.assets.map((asset) => asset.id)).toEqual([
      "test-orbiter",
      "gold-orbiter",
      "test-relay",
    ]);
  });
});

describe("validating a plan", () => {
  it("reports the Mission's total cost", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendOrbiter)).toEqual({
      costMillions: 500,
      problems: [],
    });
  });

  it("rejects a plan the player can't afford, with a clear reason", () => {
    const { simulation, program } = setup();
    const plan = {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["gold-orbiter"] },
    };
    const { costMillions, problems } = simulation.validatePlan(program, plan);
    expect(costMillions).toBe(5100);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/\$5\.1B.*\$2B/);
    expect(() => simulation.runTurn(program, plan)).toThrow(/\$5\.1B/);
  });

  it("rejects ids that aren't in the catalogue", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "nope", assetIds: ["also-nope"] },
    });
    expect(problems.join(" ")).toContain("nope");
    expect(problems.join(" ")).toContain("also-nope");
  });

  it("rejects a Mission that carries nothing", () => {
    const { simulation, program } = setup();
    const { problems } = simulation.validatePlan(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: [] },
    });
    expect(problems).toHaveLength(1);
  });
});

describe("running a Turn with a Mission", () => {
  it("deducts the Mission's cost", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
    });
    expect(simulation.readProgram(next).moneyMillions).toBe(1800);
  });

  it("produces every Mission Event in order, all succeeding", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(
      timeline.entries
        .filter((entry) => entry.kind === "missionEvent")
        .map((entry) => [entry.title, entry.day, entry.outcome]),
    ).toEqual([
      ["Test launch", 0, "success"],
      ["Test burn", 1, "success"],
      ["Test arrival", 200, "success"],
    ]);
  });

  it("keeps the whole timeline in date order", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        assets: [
          {
            ...files.assets[0],
            missionEvents: ["test-arrival", "test-settle"],
          },
          ...files.assets.slice(1),
        ],
        missionEvents: [
          ...files.missionEvents,
          {
            id: "test-settle",
            name: "Test settle",
            description: "Settles into orbit.",
            timing: { from: "arrival", days: 5 },
          },
        ],
      } as CatalogueFiles),
    );
    const { timeline } = simulation.runTurn(
      simulation.startProgram(1),
      sendOrbiter,
    );
    const days = timeline.entries.map((entry) => entry.day);
    expect(days).toEqual(days.toSorted((first, second) => first - second));
    expect(days.at(-1)).toBe(205);
  });

  it("describes the journey for Mission Mode to show", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.startDate).toBe("2028-12-01");
    expect(timeline.durationDays).toBe(780);
    expect(timeline.mission).toEqual({
      launchDay: 0,
      arrivalDay: 200,
      launchVehicleName: "Test Vehicle",
      assetNames: ["Test Orbiter"],
    });
  });

  it("tells Mission Mode which Assets were already operating when the Turn began", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    expect(first.timeline.operatingAssetNames).toEqual([]);
    const second = simulation.runTurn(first.program, sendOrbiter);
    expect(second.timeline.operatingAssetNames).toEqual(["Test Orbiter"]);
  });

  it("leaves the orbiter operating at Mars in later Turns", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter).program;
    const second = simulation.runTurn(first, sendOrbiter).program;
    expect(simulation.readProgram(second).operatingAssets).toEqual([
      {
        assetId: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        arrivedOn: "2029-06-19",
      },
      {
        assetId: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        arrivedOn: "2031-08-08",
      },
    ]);
  });

  it("moves the date on to the next Launch Window, about 26 months later", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(next);
    expect(view.turnNumber).toBe(2);
    expect(view.date).toBe("2031-01-20");
  });
});

describe("Milestones", () => {
  it("awards the Milestone's Science and Public Support when the first orbiter arrives", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(next);
    expect(view.science).toBe(100);
    expect(view.publicSupport).toBe(255);
    expect(view.milestones.map((milestone) => milestone.name)).toEqual([
      "First orbiter",
    ]);
  });

  it("starts a Program with no Science and no Milestones", () => {
    const { simulation, program } = setup();
    const view = simulation.readProgram(program);
    expect(view.science).toBe(0);
    expect(view.milestones).toEqual([]);
  });

  it("doesn't award the same Milestone for a second orbiter", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, sendOrbiter);
    const second = simulation.runTurn(first.program, sendOrbiter);
    const view = simulation.readProgram(second.program);
    expect(view.science).toBe(100);
    expect(view.milestones).toHaveLength(1);
    expect(second.summary.milestones).toEqual([]);
    expect(
      second.timeline.entries.filter((entry) => entry.kind === "milestone"),
    ).toEqual([]);
  });

  it("appears on the timeline after the arrival that earned it", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.entries.map((entry) => [entry.title, entry.day])).toEqual([
      ["Test launch", 0],
      ["Test burn", 1],
      ["Test arrival", 200],
      ["First orbiter", 200],
      ["Funding Threshold reached: 300 Public Support", 200],
    ]);
  });

  it("is reported in the Turn summary with the Turn's other changes", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary).toMatchObject({
      missionCostMillions: 500,
      moneyStartMillions: 2000,
      // Less the Mission's $500M, plus the $1B Funding Threshold payout.
      moneyEndMillions: 2500,
      scienceGained: 100,
      publicSupportStart: 100,
      publicSupportEnd: 255,
      milestones: [{ name: "First orbiter", science: 100, publicSupport: 200 }],
    });
  });

  it("awards a Milestone for each kind of Asset that arrives", () => {
    const { simulation, program } = setup();
    const { program: next } = simulation.runTurn(program, {
      mission: {
        launchVehicleId: "test-vehicle",
        assetIds: ["test-orbiter", "test-relay"],
      },
    });
    expect(simulation.readProgram(next).science).toBe(110);
  });
});

const skipTurn: TurnPlan = { mission: null };

describe("Funding Thresholds", () => {
  const sendRelay: TurnPlan = {
    mission: { launchVehicleId: "test-vehicle", assetIds: ["test-relay"] },
  };

  function withThresholds(
    fundingThresholds: { publicSupport: number; payoutMillions: number }[],
  ) {
    const simulation = createSimulation(
      parseCatalogue({ ...testCatalogueFiles(), fundingThresholds }),
    );
    return { simulation, program: simulation.startProgram(1) };
  }

  it("pays out when a Milestone takes Public Support to the threshold", () => {
    const { simulation, program } = setup();
    const { program: next, summary } = simulation.runTurn(program, sendOrbiter);
    // $2B, less $500M for the Mission, plus $1B from reaching 300.
    expect(simulation.readProgram(next).moneyMillions).toBe(2500);
    expect(summary.moneyEndMillions).toBe(2500);
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 300, payoutMillions: 1000 },
    ]);
  });

  it("appears on the timeline after the Milestone that caused it", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(timeline.entries.at(-1)).toMatchObject({
      kind: "fundingThreshold",
      day: 200,
    });
    expect(timeline.entries.at(-1)?.description).toContain("$1B");
  });

  it("doesn't pay when Public Support stays short of the threshold", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendRelay);
    expect(summary.fundingPayouts).toEqual([]);
  });

  it("pays nothing when Public Support falls below a threshold and reaches it again", () => {
    const { simulation, program } = setup();
    // 100 + 200 reaches 300, which pays, and then drains to 255.
    const first = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(first.program).publicSupport).toBe(255);
    // 255 + 100 is back above 300.
    const second = simulation.runTurn(first.program, sendRelay);
    expect(second.summary.publicSupportGained).toBe(100);
    expect(second.summary.fundingPayouts).toEqual([]);
    expect(simulation.readProgram(second.program).moneyMillions).toBe(2300);
  });

  it("pays each threshold once when one award crosses several", () => {
    const { simulation, program } = withThresholds([
      { publicSupport: 150, payoutMillions: 10 },
      { publicSupport: 250, payoutMillions: 20 },
      { publicSupport: 500, payoutMillions: 40 },
    ]);
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary.fundingPayouts).toEqual([
      { publicSupport: 150, payoutMillions: 10 },
      { publicSupport: 250, payoutMillions: 20 },
    ]);
    expect(summary.moneyEndMillions).toBe(2000 - 500 + 30);
  });

  it("tells Planning Mode about the next threshold and how far away it is", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).nextFundingThreshold).toEqual({
      publicSupport: 300,
      payoutMillions: 1000,
      pointsAway: 200,
    });
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).nextFundingThreshold).toEqual({
      publicSupport: 1000,
      payoutMillions: 7000,
      pointsAway: 745,
    });
  });

  it("reports no next threshold when they have all been paid", () => {
    const { simulation, program } = withThresholds([
      { publicSupport: 300, payoutMillions: 1000 },
    ]);
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).nextFundingThreshold).toBeNull();
  });
});

describe("a Turn without a Mission", () => {
  it("still moves on to the next Launch Window, spending nothing", () => {
    const { simulation, program } = setup();
    const { program: next, timeline } = simulation.runTurn(program, skipTurn);
    const view = simulation.readProgram(next);
    expect(view.turnNumber).toBe(2);
    expect(view.date).toBe("2031-01-20");
    expect(view.moneyMillions).toBe(2000);
    expect(timeline.mission).toBeNull();
    expect(timeline.entries).toEqual([]);
    expect(timeline.durationDays).toBe(780);
  });

  it("is a valid plan even with no money", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, skipTurn)).toEqual({
      costMillions: 0,
      problems: [],
    });
  });
});

describe("Public Support drain", () => {
  it("falls by the configured percentage each Turn", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, skipTurn).program;
    expect(simulation.readProgram(first).publicSupport).toBe(85);
    const second = simulation.runTurn(first, skipTurn).program;
    expect(simulation.readProgram(second).publicSupport).toBe(72);
  });

  it("is shown in the Turn summary", () => {
    const { simulation, program } = setup();
    const { summary } = simulation.runTurn(program, sendOrbiter);
    expect(summary).toMatchObject({
      publicSupportStart: 100,
      publicSupportGained: 200,
      publicSupportDrained: 45,
      publicSupportEnd: 255,
    });
  });
});

describe("cancellation", () => {
  function skipUntilEnded(start: { simulation: Simulation; program: Program }) {
    const { simulation } = start;
    let { program } = start;
    let turns = 0;
    while (simulation.readProgram(program).status.kind === "active") {
      program = simulation.runTurn(program, skipTurn).program;
      turns += 1;
      expect(turns).toBeLessThan(1000);
    }
    return { program, turns };
  }

  it("ends a Program that only skips Turns, with the reason", () => {
    const start = setup();
    const { program, turns } = skipUntilEnded(start);
    // 100, 85, 72, 61, 51, then 43, which is below the Cancellation Level of 50.
    expect(turns).toBe(5);
    const { status, publicSupport } = start.simulation.readProgram(program);
    expect(publicSupport).toBe(43);
    expect(status).toEqual({
      kind: "cancelled",
      reason: "Public Support fell to 43, below the Cancellation Level of 50.",
    });
  });

  it("doesn't cancel at exactly the Cancellation Level", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, cancellationLevel: 85 },
      }),
    );
    const { program } = simulation.runTurn(
      simulation.startProgram(1),
      skipTurn,
    );
    expect(simulation.readProgram(program).status.kind).toBe("active");
  });

  it("ends even a Program whose Public Support drains very slowly", () => {
    const files = testCatalogueFiles();
    const simulation = createSimulation(
      parseCatalogue({
        ...files,
        program: {
          ...files.program,
          publicSupportDrainPercent: 1,
          cancellationLevel: 1,
        },
      }),
    );
    const { turns } = skipUntilEnded({
      simulation,
      program: simulation.startProgram(1),
    });
    expect(turns).toBeGreaterThan(5);
  });

  it("reports the cancellation in the Turn summary", () => {
    const { simulation } = setup();
    let program = simulation.startProgram(1);
    for (let turn = 0; turn < 4; turn++) {
      program = simulation.runTurn(program, skipTurn).program;
    }
    const { summary } = simulation.runTurn(program, skipTurn);
    expect(summary.cancellationReason).toContain("Cancellation Level");
  });

  it("doesn't let an ended Program run another Turn", () => {
    const start = setup();
    const { program } = skipUntilEnded(start);
    expect(() => start.simulation.runTurn(program, skipTurn)).toThrow(
      /has ended/,
    );
  });
});

describe("retirement", () => {
  it("ends the Program and keeps its Science and Milestones", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, sendOrbiter);
    const view = simulation.readProgram(simulation.retireProgram(flown));
    expect(view.status).toEqual({ kind: "retired" });
    expect(view.science).toBe(100);
    expect(view.milestones.map((milestone) => milestone.name)).toEqual([
      "First orbiter",
    ]);
  });

  it("reports any plan for an ended Program as a problem", () => {
    const { simulation, program } = setup();
    const retired = simulation.retireProgram(program);
    expect(simulation.validatePlan(retired, skipTurn).problems).toEqual([
      "This Program has ended.",
    ]);
  });

  it("doesn't let a retired Program run another Turn", () => {
    const { simulation, program } = setup();
    const retired = simulation.retireProgram(program);
    expect(() => simulation.runTurn(retired, skipTurn)).toThrow(/has ended/);
  });
});

describe("time and determinism", () => {
  it("passes no game time while planning", () => {
    const { simulation, program } = setup();
    simulation.validatePlan(program, sendOrbiter);
    simulation.readProgram(program);
    expect(simulation.readProgram(program).date).toBe("2028-12-01");
  });

  it("gives the same result for the same seed and plans", () => {
    const play = () => {
      const { simulation, program } = setup();
      const first = simulation.runTurn(program, sendOrbiter);
      return [first, simulation.runTurn(first.program, sendOrbiter)];
    };
    expect(play()).toEqual(play());
  });

  it("doesn't change the Program passed in", () => {
    const { simulation, program } = setup();
    const before = structuredClone(program);
    simulation.runTurn(program, sendOrbiter);
    expect(program).toEqual(before);
  });
});
