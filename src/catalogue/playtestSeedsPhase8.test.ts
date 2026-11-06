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
describe("the known seeds in the Phase 8 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-8.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  /** The guide's first Mission: the Trailblazer Rover at Jezero Crater, with its longer Service Life. */
  const rover = (activityId?: string): TurnPlan => ({
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["trailblazer-rover"],
      landingSiteId: "jezero-crater",
      assetChoices: {
        "trailblazer-rover": {
          serviceLifeDays: 2800,
          ...(activityId ? { activityId } : {}),
        },
      },
    },
  });
  /** The smallest Crew on a round trip on the Meridian Colossus, with what Planning Mode chooses for them unless told otherwise. */
  const roundTrip: TurnPlan = {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: [],
      crew: { size: 2, roundTrip: true },
    },
  };

  /** Works out a Turn that the guide says has nothing to decide. */
  function turnWithNoDecision(program: Program, plan: TurnPlan) {
    expect(real.validatePlan(program, plan).problems).toEqual([]);
    const progress = real.workOutTurn(program, plan);
    expect(progress.decisionPoint).toBeNull();
    if (progress.decisionPoint) throw new Error("Expected no Decision Point");
    return progress.result;
  }

  /**
   * Turns 1 to 5 of the guide's Crew scenario: a rover, the Meridian Colossus developed, two Turns of waiting, then
   * round-trip Crew who reach Mars orbit.
   */
  function crewAtMars(seed: number): Program {
    const first = turnWithNoDecision(real.startProgram(seed), rover());
    expect(first.summary).toMatchObject({
      moneyEndMillions: 3880,
      publicSupportEnd: 388,
    });
    const second = turnWithNoDecision(first.program, {
      mission: null,
      developmentIds: ["meridian-colossus"],
    });
    expect(second.summary.moneyEndMillions).toBe(3715);
    const third = turnWithNoDecision(second.program, { mission: null });
    expect(third.summary).toMatchObject({
      moneyEndMillions: 4750,
      developmentsFinished: ["Meridian Colossus"],
    });
    const fourth = turnWithNoDecision(third.program, { mission: null });
    expect(fourth.summary).toMatchObject({
      moneyEndMillions: 5685,
      publicSupportEnd: 256,
    });
    expect(real.validatePlan(fourth.program, roundTrip).costMillions).toBe(
      4800,
    );
    const fifth = turnWithNoDecision(fourth.program, roundTrip);
    expect(fifth.summary).toMatchObject({
      moneyEndMillions: 3371,
      publicSupportEnd: 657,
      failure: null,
    });
    expect(fifth.summary.milestones.map(({ name }) => name)).toContain(
      "First Crew at Mars",
    );
    expect(fifth.summary.crew.map(({ health }) => health)).toEqual([45, 45]);
    return fifth.program;
  }

  /** The guide's sixth Turn: bringing the Crew home, with no Mission. */
  function bringHome(program: Program) {
    const [wayHome] = real.readProgram(program).crew[0]?.waysHome ?? [];
    expect(wayHome).toMatchObject({
      names: ["Amara Okafor", "Lena Petrova"],
      reason: null,
    });
    return turnWithNoDecision(program, {
      mission: null,
      bringHome: wayHome?.key ?? "",
    });
  }

  it("has round-trip Crew who come home safe a Turn after they reach Mars orbit", () => {
    expect(guide).toContain("?seed=233)");
    const home = bringHome(crewAtMars(233));
    expect(home.summary).toMatchObject({
      moneyEndMillions: 8149,
      publicSupportEnd: 985,
      publicSupportForCrewHome: 200,
      milestones: [expect.objectContaining({ name: "First Crew home" })],
      crewHome: ["Amara Okafor", "Lena Petrova"],
      crewLost: [],
      journeyHome: { failure: null },
    });
  });

  it("has round-trip Crew lost on the way home when Earth entry fails", () => {
    expect(guide).toContain("?seed=413)");
    const lost = bringHome(crewAtMars(413));
    expect(lost.summary).toMatchObject({
      moneyEndMillions: 3649,
      publicSupportEnd: 415,
      crewHome: [],
      crewLost: [
        {
          description:
            "Amara Okafor and Lena Petrova were lost when Earth entry failed.",
          publicSupportLost: 150,
        },
      ],
      journeyHome: {
        failure: { missionEventName: "Earth entry", publicSupportLost: 20 },
      },
    });
  });

  it("has samples cached by a rover that an ascent vehicle and an Earth return orbiter bring home", () => {
    expect(guide).toContain("?seed=233)");
    const first = turnWithNoDecision(
      real.startProgram(233),
      rover("sample-caching"),
    );
    expect(first.summary).toMatchObject({
      moneyEndMillions: 3300,
      publicSupportEnd: 382,
      samplesCached: [expect.objectContaining({ samples: 8 })],
    });
    const liftAndOrbiter: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-heavy",
        assetIds: ["kestrel-ascent-vehicle", "albatross-return-orbiter"],
        landingSiteId: "jezero-crater",
      },
    };
    expect(real.validatePlan(first.program, liftAndOrbiter).costMillions).toBe(
      3000,
    );
    const second = turnWithNoDecision(first.program, liftAndOrbiter);
    expect(second.summary.moneyEndMillions).toBe(535);
    expect(real.readProgram(second.program).sampleReturns).toMatchObject([
      { samples: 18, science: 1440, reason: null },
    ]);
    const third = turnWithNoDecision(second.program, {
      mission: null,
      bringHome: "samples:jezero-crater",
    });
    expect(third.summary).toMatchObject({
      moneyEndMillions: 7250,
      publicSupportEnd: 1125,
      samplesHome: [
        {
          from: "Jezero Crater",
          samples: 18,
          science: 1440,
          broughtBy: "Albatross Orbiter",
        },
      ],
    });
    expect(third.summary.milestones.map(({ name }) => name)).toEqual([
      "First sample returned",
      "700 Science earned",
      "1200 Science earned",
      "1800 Science earned",
    ]);
  });
});
