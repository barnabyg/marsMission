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
describe("the known seeds in the Phase 7 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-7.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  const rover: TurnPlan = {
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["trailblazer-rover"],
      landingSiteId: "jezero-crater",
      assetChoices: { "trailblazer-rover": { serviceLifeDays: 2800 } },
    },
  };
  /** The smallest Crew on the Meridian Colossus, with what Planning Mode chooses for them unless told otherwise. */
  const crewed = (trajectoryId?: string): TurnPlan => ({
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: [],
      crew: { size: 2 },
      ...(trajectoryId ? { trajectoryId } : {}),
    },
  });

  /** Works out a Turn that the guide says has nothing to decide. */
  function turnWithNoDecision(program: Program, plan: TurnPlan) {
    const progress = real.workOutTurn(program, plan);
    expect(progress.decisionPoint).toBeNull();
    if (progress.decisionPoint) throw new Error("Expected no Decision Point");
    return progress.result;
  }

  /** Turns 1 to 4 of the guide's scenario: a rover, then the Meridian Colossus developed, then two Turns of waiting. */
  function readyForCrew(seed: number): Program {
    const start = real.startProgram(seed);
    expect(real.validatePlan(start, rover).costMillions).toBe(1700);
    const first = turnWithNoDecision(start, rover);
    expect(first.summary).toMatchObject({
      moneyEndMillions: 3680,
      publicSupportEnd: 388,
      failure: null,
    });
    const second = turnWithNoDecision(first.program, {
      mission: null,
      developmentIds: ["meridian-colossus"],
    });
    expect(second.summary).toMatchObject({
      developmentCostMillions: 1200,
      moneyEndMillions: 3280,
      developmentsStarted: ["Meridian Colossus"],
    });
    const third = turnWithNoDecision(second.program, { mission: null });
    expect(third.summary).toMatchObject({
      moneyEndMillions: 4080,
      developmentsFinished: ["Meridian Colossus"],
    });
    const fourth = turnWithNoDecision(third.program, { mission: null });
    expect(fourth.summary).toMatchObject({
      moneyEndMillions: 4780,
      publicSupportEnd: 256,
      assetsEnded: ["Trailblazer Rover"],
    });
    return fourth.program;
  }

  it("has Crew who arrive safely in Mars orbit, and are lost when their Health runs out a Turn later", () => {
    expect(guide).toContain("?seed=3)");
    const ready = readyForCrew(3);
    // Too heavy for the Meridian Heavy.
    expect(
      real.validatePlan(ready, {
        mission: { ...crewed().mission, launchVehicleId: "meridian-heavy" },
      } as TurnPlan).problems,
    ).toEqual([
      "This Mission weighs 10.5 tonnes, but its Launch Vehicle can only carry 8 tonnes.",
    ]);
    expect(real.validatePlan(ready, crewed()).costMillions).toBe(4200);
    const mission = crewed().mission;
    if (!mission) throw new Error("Expected a Mission");
    expect(real.previewCrew(ready, mission)).toMatchObject({
      names: ["Amara Okafor", "Lena Petrova"],
      arrivalHealth: 79,
    });

    const fifth = turnWithNoDecision(ready, crewed());
    expect(fifth.summary).toMatchObject({
      moneyEndMillions: 2816,
      publicSupportEnd: 657,
      failure: null,
      crewLost: [],
    });
    expect(fifth.summary.milestones.map(({ name }) => name)).toContain(
      "First Crew at Mars",
    );
    expect(fifth.summary.crew.map(({ health }) => health)).toEqual([45, 45]);
    expect(real.readProgram(fifth.program).crew).toMatchObject([
      { locationName: "Mars orbit", suppliesDaysLeft: 1095 },
    ]);

    const sixth = turnWithNoDecision(fifth.program, { mission: null });
    expect(sixth.summary).toMatchObject({
      publicSupportEnd: 451,
      crewLost: [
        {
          description:
            "Amara Okafor and Lena Petrova were lost in Mars orbit, when their Health ran out.",
          publicSupportLost: 150,
        },
      ],
    });
  });

  it("has Crew lost when Mars orbit insertion fails, whom a Free-return brings home from the same Turn", () => {
    expect(guide).toContain("?seed=33)");
    const ready = readyForCrew(33);

    const lost = turnWithNoDecision(ready, crewed());
    expect(lost.summary).toMatchObject({
      moneyEndMillions: 580,
      publicSupportEnd: 73,
      failure: {
        missionEventName: "Mars orbit insertion",
        publicSupportLost: 20,
      },
      crewLost: [
        {
          description:
            "Amara Okafor and Lena Petrova were lost when Mars orbit insertion failed.",
          publicSupportLost: 150,
        },
      ],
    });
    expect(real.readProgram(lost.program).status.kind).toBe("active");

    expect(real.validatePlan(ready, crewed("free-return")).costMillions).toBe(
      4230,
    );
    const home = turnWithNoDecision(ready, crewed("free-return"));
    expect(home.summary).toMatchObject({
      moneyEndMillions: 550,
      publicSupportEnd: 217,
      failure: {
        missionEventName: "Mars orbit insertion",
        returnedToEarth: true,
      },
      crewLost: [],
      crewHome: ["Amara Okafor", "Lena Petrova"],
    });
    expect(home.summary.healthLost).toEqual([
      {
        name: "Amara Okafor",
        lost: [{ cause: "radiationInFlight", health: 63 }],
      },
      {
        name: "Lena Petrova",
        lost: [{ cause: "radiationInFlight", health: 63 }],
      },
    ]);
  });
});
