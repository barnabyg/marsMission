import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The real numbers, with every Mission Event certain to fail or certain to succeed. */
function realSimulation(failureProbability: 0 | 1) {
  const files = realCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability,
      })),
    }),
  );
}

const failing = realSimulation(1);
const succeeding = realSimulation(0);
const files = realCatalogueFiles();

const mission = {
  launchVehicleId: files.launchVehicles[0]?.id ?? "",
  assetIds: [files.assets[0]?.id ?? ""],
};
const plainMission: TurnPlan = { mission };

/** The first Mission with the same Reliability level on every one of its Mission Events. */
function missionWithEveryEventAt(levelId: string): TurnPlan {
  return {
    mission: {
      ...mission,
      reliability: Object.fromEntries(
        succeeding
          .previewMission(mission)
          .map((event) => [event.eventId, levelId]),
      ),
    },
  };
}

/** The first Mission's result under a seed where it fails, which Reliability makes less likely. */
function firstMissionFailing(plan: TurnPlan) {
  for (let seed = 1; seed < 1000; seed++) {
    const result = failing.runTurn(failing.startProgram(seed), plan);
    if (result.summary.failure) return result;
  }
  throw new Error("Expected the first Mission to fail under some seed");
}

const [, modestLevel] = files.reliabilityLevels;
const highestLevel = files.reliabilityLevels.at(-1);

describe("the balance of the first Missions", () => {
  it("lets a retry after a first failure be afforded and, if it succeeds, cross the first Funding Threshold", () => {
    const first = failing.runTurn(failing.startProgram(1), plainMission);
    expect(failing.readProgram(first.program).status.kind).toBe("active");
    expect(failing.validatePlan(first.program, plainMission).problems).toEqual(
      [],
    );
    const retry = succeeding.runTurn(first.program, plainMission);
    expect(retry.summary.fundingPayouts[0]).toEqual(files.fundingThresholds[0]);
  });

  it("leaves enough for a retry without Reliability after a modest Reliability spend", () => {
    const plan = missionWithEveryEventAt(modestLevel?.id ?? "");
    expect(
      failing.validatePlan(failing.startProgram(1), plan).problems,
    ).toEqual([]);
    const first = firstMissionFailing(plan);
    expect(failing.validatePlan(first.program, plainMission).problems).toEqual(
      [],
    );
  });

  it("leaves too little for a retry after the highest Reliability on every Mission Event", () => {
    const plan = missionWithEveryEventAt(highestLevel?.id ?? "");
    expect(
      failing.validatePlan(failing.startProgram(1), plan).problems,
    ).toEqual([]);
    const first = firstMissionFailing(plan);
    expect(
      failing.validatePlan(first.program, plainMission).problems,
    ).toHaveLength(1);
  });

  it("cancels the Program after two failures in a row at the start", () => {
    const first = failing.runTurn(failing.startProgram(1), plainMission);
    const second = failing.runTurn(first.program, plainMission);
    expect(failing.readProgram(second.program).status.kind).toBe("cancelled");
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
