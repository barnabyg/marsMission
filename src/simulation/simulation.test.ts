import { describe, expect, it } from "vitest";
import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogue } from "./testCatalogue";

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
    const { program: next } = simulation.runTurn(program, sendOrbiter);
    expect(simulation.readProgram(next).moneyMillions).toBe(1500);
  });

  it("produces every Mission Event in order, all succeeding", () => {
    const { simulation, program } = setup();
    const { timeline } = simulation.runTurn(program, sendOrbiter);
    expect(
      timeline.entries.map((entry) => [entry.title, entry.day, entry.outcome]),
    ).toEqual([
      ["Test launch", 0, "success"],
      ["Test burn", 1, "success"],
      ["Test arrival", 200, "success"],
    ]);
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
