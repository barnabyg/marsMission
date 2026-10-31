import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";
import { files, mission, plainMission } from "../testing/realBalance";

describe("the known seeds in the Phase 4 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-4.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  const vehicle = files.launchVehicles[0]?.id ?? "";
  const rover = (landingSiteId: string): TurnPlan => ({
    mission: {
      launchVehicleId: vehicle,
      assetIds: ["trailblazer-rover"],
      landingSiteId,
    },
  });
  const lander: TurnPlan = {
    mission: {
      launchVehicleId: vehicle,
      assetIds: ["prospector-lander"],
      landingSiteId: "jezero-crater",
    },
  };

  // If tuning fails one of these, find a new seed that gives this story and update the guide.
  it("has a rover that lands on Turn 1 and is paid a Research Grant", () => {
    expect(guide).toContain("?seed=3)");
    const first = real.runTurn(real.startProgram(3), rover("jezero-crater"));
    expect(first.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 3980,
      publicSupportEnd: 388,
      scienceGained: 388,
      researchGrantMillions: 580,
    });
    expect(first.summary.fundingPayouts).toHaveLength(2);
    const second = real.runTurn(first.program, plainMission);
    expect(second.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 3740,
      publicSupportEnd: 507,
      researchGrantMillions: 760,
      assetsEnded: ["Trailblazer Rover"],
    });
  });

  it("has a rover that crashes on Turn 1, which leaves too little to launch again", () => {
    expect(guide).toContain("?seed=1)");
    const crash = real.runTurn(real.startProgram(1), rover("jezero-crater"));
    expect(crash.summary).toMatchObject({
      moneyEndMillions: 900,
      publicSupportEnd: 68,
      researchGrantMillions: 0,
    });
    expect(crash.summary.failure?.missionEventName).toBe(
      "Entry/descent/landing",
    );
    expect(
      real.validatePlan(crash.program, plainMission).problems,
    ).toHaveLength(1);
    expect(real.validatePlan(crash.program, lander).problems).toHaveLength(1);
  });

  it("has a Program that Surveys first, and moves from Funding Thresholds to Research Grants", () => {
    const first = real.runTurn(real.startProgram(1), plainMission);
    expect(first.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 2300,
      publicSupportEnd: 255,
    });
    const second = real.runTurn(first.program, lander);
    expect(second.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 2737,
      publicSupportEnd: 435,
      scienceGained: 343,
      researchGrantMillions: 37,
    });
    const third = real.runTurn(second.program, rover("meridiani-planum"));
    expect(third.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 3965,
      publicSupportEnd: 553,
      researchGrantMillions: 628,
    });
    expect(third.summary.fundingPayouts).toHaveLength(1);
    const fourth = real.runTurn(third.program, { mission: null });
    expect(fourth.summary).toMatchObject({
      moneyEndMillions: 4725,
      publicSupportEnd: 477,
      researchGrantMillions: 760,
      fundingPayouts: [],
      assetsEnded: ["Trailblazer Rover"],
    });
    const fifth = real.runTurn(fourth.program, { mission: null });
    expect(fifth.summary).toMatchObject({
      moneyEndMillions: 4725,
      publicSupportEnd: 405,
      researchGrantMillions: 0,
    });
  });
});

describe("the known seeds in the Phase 3 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-3.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  const land: TurnPlan = {
    mission: {
      ...mission,
      assetIds: ["prospector-lander"],
      landingSiteId: "jezero-crater",
    },
  };
  const orbit = plainMission;

  it("has a landing that crashes straight away and works after a Survey", () => {
    expect(guide).toContain("?seed=1)");
    const crash = real.runTurn(real.startProgram(1), land);
    expect(crash.summary.failure?.missionEventName).toBe(
      "Entry/descent/landing",
    );
    expect(crash.summary.publicSupportEnd).toBe(68);
    expect(crash.summary.moneyEndMillions).toBe(1200);

    const first = real.runTurn(real.startProgram(1), orbit);
    expect(first.summary).toMatchObject({
      failure: null,
      moneyEndMillions: 2300,
      publicSupportEnd: 255,
    });
    const second = real.runTurn(first.program, land);
    // The money, Public Support and Science have moved since the guide was written, because research now earns more.
    expect(second.summary).toMatchObject({
      failure: null,
      assetsEnded: ["Pathfinder Orbiter"],
      assetsFailed: [],
      moneyEndMillions: 2737,
      publicSupportEnd: 435,
      scienceGained: 343,
    });
    expect(second.summary.survey?.siteNameRevealed).toBe("Utopia Planitia");
  });

  it("has a landing that works straight away", () => {
    expect(guide).toContain("?seed=3)");
    expect(real.runTurn(real.startProgram(3), land).summary.failure).toBeNull();
  });

  it("has a landing that crashes even after a Survey", () => {
    expect(guide).toContain("?seed=4)");
    const first = real.runTurn(real.startProgram(4), orbit);
    expect(first.summary.failure).toBeNull();
    expect(
      real.runTurn(first.program, land).summary.failure?.missionEventName,
    ).toBe("Entry/descent/landing");
  });

  it("has an orbiter that fails in service on the next Turn", () => {
    expect(guide).toContain("?seed=15)");
    const first = real.runTurn(real.startProgram(15), orbit);
    expect(first.summary.failure).toBeNull();
    const second = real.runTurn(first.program, { mission: null });
    expect(second.summary.assetsFailed).toEqual(["Pathfinder Orbiter"]);
  });
});

describe("the known seeds in the Phase 2 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-2.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));

  function failuresOverTwoTurns(seed: number) {
    const first = real.runTurn(real.startProgram(seed), plainMission);
    const second = real.runTurn(first.program, plainMission);
    return {
      first: first.summary.failure?.missionEventName ?? null,
      second: second.summary.failure?.missionEventName ?? null,
      status: real.readProgram(second.program).status.kind,
    };
  }

  // If tuning fails one of these, find a new seed that gives this story and update the guide.
  it("has a first Mission that succeeds", () => {
    expect(guide).toContain("?seed=1)");
    expect(failuresOverTwoTurns(1).first).toBeNull();
  });

  it("has a failed launch followed by a successful retry", () => {
    expect(guide).toContain("?seed=6)");
    expect(failuresOverTwoTurns(6)).toMatchObject({
      first: "Launch",
      second: null,
    });
  });

  it("has two failures in a row, which cancel the Program", () => {
    expect(guide).toContain("?seed=2)");
    expect(failuresOverTwoTurns(2)).toEqual({
      first: "Mars transfer burn",
      second: "Launch",
      status: "cancelled",
    });
  });

  it("has an orbit insertion failure that Redundant Reliability avoids", () => {
    expect(guide).toContain("?seed=13)");
    expect(failuresOverTwoTurns(13).first).toBe("Mars orbit insertion");
    const bought = real.runTurn(real.startProgram(13), {
      mission: {
        ...mission,
        reliability: { "mars-orbit-insertion": "redundant" },
      },
    });
    expect(bought.summary.failure).toBeNull();
  });
});
