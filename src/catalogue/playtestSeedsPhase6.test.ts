import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
} from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";

// Only the current playtest guide's known seeds are tested, and these tests move to the new guide with each phase.
// If tuning fails one of these, find a new seed that gives this story and update this guide. Earlier guides are records and aren't updated.
describe("the known seeds in the Phase 6 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-6.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  const pinpointMission = {
    launchVehicleId: "meridian-medium",
    assetIds: ["pinpoint-lander"],
    landingSiteId: "jezero-crater",
  };
  const pinpoint: TurnPlan = { mission: pinpointMission };
  const riskBands = (program: Program, plan: TurnPlan) =>
    plan.mission
      ? real
          .previewMission(program, plan.mission)
          .map(({ eventId, riskBand }) => [eventId, riskBand])
      : [];

  /** Works out a Turn that the guide says has nothing to decide. */
  function turnWithNoDecision(program: Program, plan: TurnPlan) {
    const progress = real.workOutTurn(program, plan);
    expect(progress.decisionPoint).toBeNull();
    if (progress.decisionPoint) throw new Error("Expected no Decision Point");
    return progress.result;
  }

  it("has an unproven Pinpoint Lander that lands and becomes Flight-proven, and then a relay orbiter that raises its research", () => {
    expect(guide).toContain("?seed=3)");
    const start = real.startProgram(3);
    expect(real.validatePlan(start, pinpoint).costMillions).toBe(1400);
    expect(riskBands(start, pinpoint).at(-1)).toEqual([
      "entry-descent-landing",
      "Over 30%",
    ]);
    const first = turnWithNoDecision(start, pinpoint);
    expect(first.summary).toMatchObject({
      moneyEndMillions: 1937,
      publicSupportEnd: 303,
      failure: null,
      technologiesProven: ["Pinpoint Lander"],
    });

    const view = real.readProgram(first.program);
    expect(
      view.assets.find(({ id }) => id === "pinpoint-lander"),
    ).toMatchObject({
      costMillions: 900,
      technologyReadiness: "flight-proven",
    });
    const toGale: TurnPlan = {
      mission: { ...pinpointMission, landingSiteId: "gale-crater" },
    };
    expect(riskBands(first.program, toGale).at(-1)).toEqual([
      "entry-descent-landing",
      "~20%",
    ]);

    const relay: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-medium",
        assetIds: ["courier-relay-orbiter"],
      },
    };
    expect(real.validatePlan(first.program, relay).costMillions).toBe(1200);
    const second = turnWithNoDecision(first.program, relay);
    expect(second.summary).toMatchObject({
      moneyEndMillions: 2310,
      publicSupportEnd: 439,
      failure: null,
    });
    const [research] = second.summary.ongoingResearch;
    expect(research).toMatchObject({
      assetName: "Pinpoint Lander",
      science: 145,
      days: 735,
    });
    expect(research?.benefit).toMatchObject({ days: 525, science: 50 });
  });

  it("has an unproven Pinpoint Lander that crashes, leaving too little for a retry", () => {
    expect(guide).toContain("?seed=1)");
    const { summary, program } = turnWithNoDecision(
      real.startProgram(1),
      pinpoint,
    );
    expect(summary).toMatchObject({
      moneyEndMillions: 900,
      publicSupportEnd: 68,
      failure: { missionEventName: "Entry/descent/landing" },
      technologiesProven: [],
    });
    const orbiter: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-medium",
        assetIds: ["pathfinder-orbiter"],
      },
    };
    expect(real.validatePlan(program, orbiter).problems).toEqual([
      "This Mission costs $1B, but the Program only has $900M.",
    ]);
    const second = real.runTurn(program, { mission: null });
    const third = real.runTurn(second.program, { mission: null });
    expect(real.readProgram(third.program).status.kind).toBe("cancelled");
  });

  it("has a rover, then the Meridian Colossus developed over two Turns, whose first Mission fails at the rendezvous", () => {
    expect(guide).toContain("?seed=138)");
    const rover: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-medium",
        assetIds: ["trailblazer-rover"],
        landingSiteId: "jezero-crater",
      },
    };
    const first = turnWithNoDecision(real.startProgram(138), rover);
    expect(first.summary).toMatchObject({
      moneyEndMillions: 3980,
      publicSupportEnd: 388,
      failure: null,
    });

    const second = turnWithNoDecision(first.program, {
      mission: null,
      developmentIds: ["meridian-colossus"],
    });
    expect(second.summary).toMatchObject({
      developmentCostMillions: 1200,
      moneyEndMillions: 3540,
      developmentsStarted: ["Meridian Colossus"],
    });
    const third = turnWithNoDecision(second.program, { mission: null });
    expect(third.summary).toMatchObject({
      moneyEndMillions: 3540,
      publicSupportEnd: 286,
      developmentsFinished: ["Meridian Colossus"],
    });

    const colossus: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-colossus",
        assetIds: ["pathfinder-orbiter"],
      },
    };
    expect(real.validatePlan(third.program, colossus).costMillions).toBe(1800);
    expect(riskBands(third.program, colossus)).toEqual([
      ["launch", "~10%"],
      ["tanker-launch", "~5%"],
      ["rendezvous", "~10%"],
      ["mars-transfer-burn", "~5%"],
      ["mars-orbit-insertion", "~10%"],
    ]);
    const fourth = turnWithNoDecision(third.program, colossus);
    expect(fourth.summary).toMatchObject({
      moneyEndMillions: 1740,
      publicSupportEnd: 226,
      failure: { missionEventName: "Rendezvous" },
      technologiesProven: [],
    });
  });
});
