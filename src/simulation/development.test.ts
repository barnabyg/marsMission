import { describe, expect, it } from "vitest";
import { everyTechnology, type ProgramView, type TurnPlan } from "./simulation";
import { sendOrbiter, setup, skipTurn, withFailures } from "./testHelpers";

const sendFutureOrbiter: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-future-orbiter"],
  },
};

const onFutureVehicle: TurnPlan = {
  mission: {
    launchVehicleId: "test-future-vehicle",
    assetIds: ["test-orbiter"],
  },
};

describe("technology that isn't built yet", () => {
  it("can't be chosen for a Mission before its Development", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, sendFutureOrbiter).problems,
    ).toContain(
      "Test Future Orbiter can't fly until it has been through Development.",
    );
    expect(
      simulation.validatePlan(program, onFutureVehicle).problems,
    ).toContain(
      "Test Future Vehicle can't fly until it has been through Development.",
    );
  });
});

describe("Development in Planning Mode", () => {
  it("lists each technology that needs Development, with its cost and Turns", () => {
    const { simulation, program } = setup();
    expect(simulation.readProgram(program).developments).toEqual([
      {
        id: "test-future-vehicle",
        name: "Test Future Vehicle",
        costMillions: 500,
        turns: 1,
        status: "notStarted",
        turnsLeft: 1,
      },
      {
        id: "test-future-orbiter",
        name: "Test Future Orbiter",
        costMillions: 300,
        turns: 2,
        status: "notStarted",
        turnsLeft: 2,
      },
    ]);
  });
});

describe("starting Development", () => {
  const developOrbiter = (mission: TurnPlan["mission"]): TurnPlan => ({
    mission,
    developmentIds: ["test-future-orbiter"],
  });

  it("takes its whole cost from the Program's money in that Turn, alongside the Mission's cost", () => {
    const { simulation, program } = setup();
    const plan = developOrbiter(sendOrbiter.mission);
    expect(simulation.validatePlan(program, plan)).toMatchObject({
      costMillions: 500,
      developmentCostMillions: 300,
      problems: [],
    });
    const developing = simulation.runTurn(program, plan);
    const notDeveloping = simulation.runTurn(program, sendOrbiter);
    expect(developing.summary.developmentCostMillions).toBe(300);
    expect(developing.summary.missionCostMillions).toBe(500);
    expect(developing.program.moneyMillions).toBe(
      notDeveloping.program.moneyMillions - 300,
    );
  });

  it("can start without a Mission", () => {
    const { simulation, program } = setup();
    const developing = simulation.runTurn(program, developOrbiter(null));
    const skipping = simulation.runTurn(program, skipTurn);
    expect(developing.program.moneyMillions).toBe(
      skipping.program.moneyMillions - 300,
    );
  });

  it("rejects a plan that can't afford both the Mission and the Development", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 700,
    });
    expect(simulation.validatePlan(program, sendOrbiter).problems).toEqual([]);
    expect(
      simulation.validatePlan(program, developOrbiter(null)).problems,
    ).toEqual([]);
    expect(
      simulation.validatePlan(program, developOrbiter(sendOrbiter.mission))
        .problems,
    ).toEqual([
      "This Mission and Development cost $800M, but the Program only has $700M.",
    ]);
  });

  it("rejects Development it can't afford", () => {
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 200,
    });
    expect(
      simulation.validatePlan(program, developOrbiter(null)).problems,
    ).toEqual([
      "This Development costs $300M, but the Program only has $200M.",
    ]);
  });
});

describe("Development in progress", () => {
  const developOrbiter: TurnPlan = {
    mission: null,
    developmentIds: ["test-future-orbiter"],
  };
  const orbiterDevelopment = (view: ProgramView) =>
    view.developments.find(({ id }) => id === "test-future-orbiter");
  const readinessOfOrbiter = (view: ProgramView) =>
    view.assets.find(({ id }) => id === "test-future-orbiter")
      ?.technologyReadiness;

  it("finishes at the start of the Turn its set number of Turns later, when it can be chosen, unproven", () => {
    const { simulation, program } = setup();
    const turnTwo = simulation.runTurn(program, developOrbiter).program;
    const viewTwo = simulation.readProgram(turnTwo);
    expect(orbiterDevelopment(viewTwo)).toMatchObject({
      status: "inProgress",
      turnsLeft: 1,
    });
    expect(readinessOfOrbiter(viewTwo)).toBe("not-built");
    expect(
      simulation.validatePlan(turnTwo, sendFutureOrbiter).problems,
    ).toContain(
      "Test Future Orbiter can't fly until it has been through Development.",
    );

    const turnThree = simulation.runTurn(turnTwo, skipTurn).program;
    const viewThree = simulation.readProgram(turnThree);
    expect(orbiterDevelopment(viewThree)).toMatchObject({
      status: "finished",
      turnsLeft: 0,
    });
    expect(readinessOfOrbiter(viewThree)).toBe("built");
    // 100 for the Launch Vehicle and 600 for the orbiter, unproven.
    expect(simulation.validatePlan(turnThree, sendFutureOrbiter)).toMatchObject(
      { costMillions: 700, problems: [] },
    );
    const { summary } = simulation.runTurn(turnThree, sendFutureOrbiter);
    expect(summary.technologiesProven).toEqual(["Test Future Orbiter"]);
  });

  it("says in the Turn summary when Development starts and when it finishes", () => {
    const { simulation, program } = setup();
    const first = simulation.runTurn(program, developOrbiter);
    expect(first.summary).toMatchObject({
      developmentsStarted: ["Test Future Orbiter"],
      developmentsFinished: [],
    });
    const second = simulation.runTurn(first.program, skipTurn);
    expect(second.summary).toMatchObject({
      developmentsStarted: [],
      developmentsFinished: ["Test Future Orbiter"],
    });
    const third = simulation.runTurn(second.program, skipTurn);
    expect(third.summary.developmentsFinished).toEqual([]);
  });

  it("lets a Development of one Turn fly on the next, and says so in the summary of the Turn it starts", () => {
    const { simulation, program } = setup();
    const { program: next, summary } = simulation.runTurn(program, {
      ...sendOrbiter,
      developmentIds: ["test-future-vehicle"],
    });
    expect(summary).toMatchObject({
      developmentsStarted: ["Test Future Vehicle"],
      developmentsFinished: ["Test Future Vehicle"],
    });
    expect(simulation.validatePlan(next, onFutureVehicle).problems).toEqual([]);
  });

  it("runs several Developments at once", () => {
    const { simulation, program } = setup();
    const { program: next, summary } = simulation.runTurn(program, {
      mission: null,
      developmentIds: ["test-future-vehicle", "test-future-orbiter"],
    });
    expect(summary.developmentCostMillions).toBe(800);
    expect(
      simulation.readProgram(next).developments.map(({ status }) => status),
    ).toEqual(["finished", "inProgress"]);
  });

  it("can't be started twice, whether it is in progress or has finished", () => {
    const { simulation, program } = setup();
    const startedTwice =
      "Test Future Orbiter's Development has already started.";
    expect(
      simulation.validatePlan(program, {
        mission: null,
        developmentIds: ["test-future-orbiter", "test-future-orbiter"],
      }).problems,
    ).toContain("A plan can't start the same Development twice.");
    const turnTwo = simulation.runTurn(program, developOrbiter).program;
    expect(simulation.validatePlan(turnTwo, developOrbiter).problems).toEqual([
      startedTwice,
    ]);
    const turnThree = simulation.runTurn(turnTwo, skipTurn).program;
    expect(simulation.validatePlan(turnThree, developOrbiter).problems).toEqual(
      [startedTwice],
    );
  });

  it("rejects Development of a technology that doesn't need it, or doesn't exist", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, {
        mission: null,
        developmentIds: ["test-new-lander", "no-such-thing"],
      }).problems,
    ).toEqual([
      "Test New Lander is already built, so it doesn't need Development.",
      'There is no Asset or Launch Vehicle called "no-such-thing".',
    ]);
  });
});

describe("saving Development", () => {
  it("keeps Development in progress through saving and loading, finishing when it would have", () => {
    const { simulation, program } = setup();
    const { program: started } = simulation.runTurn(program, {
      mission: null,
      developmentIds: ["test-future-orbiter"],
    });
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(started))),
    );
    expect(restored).toEqual(started);
    expect(simulation.runTurn(restored, skipTurn)).toEqual(
      simulation.runTurn(started, skipTurn),
    );
  });

  it("upgrades a save from before Development with none started, and everything that needs it not built", () => {
    const { simulation } = setup();
    // A literal copy of what format 6 looks like. Don't change this: it's a compatibility contract.
    const formatSix = {
      formatVersion: 6,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-19",
        moneyMillions: 2000,
        publicSupport: 200,
        science: 100,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [
          {
            assetId: "test-lander",
            name: "Test Lander",
            kind: "lander",
            arrivedOn: "2029-06-24",
            landingSiteId: "alpha-plain",
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-research",
          },
        ],
        status: { kind: "active" },
      },
    };
    const view = simulation.readProgram(simulation.restoreProgram(formatSix));
    expect(view.developments.map(({ status }) => status)).toEqual([
      "notStarted",
      "notStarted",
    ]);
    expect(
      everyTechnology(view)
        .filter(
          ({ technologyReadiness }) => technologyReadiness === "not-built",
        )
        .map(({ id }) => id),
    ).toEqual(["test-future-vehicle", "test-future-orbiter"]);
  });
});
