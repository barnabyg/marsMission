import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import {
  failing,
  succeeding,
  files,
  mission,
  plainMission,
} from "../testing/realBalance";

/** The first Mission with the same Reliability level on every one of its Mission Events. */
function missionWithEveryEventAt(levelId: string): TurnPlan {
  return {
    mission: {
      ...mission,
      reliability: Object.fromEntries(
        succeeding
          .previewMission(succeeding.startProgram(1), mission)
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

describe("the balance of Phase 3", () => {
  const real = createSimulation(parseCatalogue(files));
  const start = real.startProgram(1);
  const orbiterId = "pathfinder-orbiter";
  const landerId = "prospector-lander";
  const [medium, heavy] = files.launchVehicles;
  const orbiterPlan: TurnPlan = {
    mission: { launchVehicleId: medium?.id ?? "", assetIds: [orbiterId] },
  };
  const landerPlan: TurnPlan = {
    mission: {
      launchVehicleId: medium?.id ?? "",
      assetIds: [landerId],
      landingSiteId: "jezero-crater",
    },
  };
  const bothPlan: TurnPlan = {
    mission: {
      launchVehicleId: heavy?.id ?? "",
      assetIds: [orbiterId, landerId],
      landingSiteId: "jezero-crater",
    },
  };
  const landingBand = (program: ReturnType<typeof real.startProgram>) =>
    real
      .previewMission(program, {
        launchVehicleId: medium?.id ?? "",
        assetIds: [landerId],
        landingSiteId: "jezero-crater",
      })
      .find(({ eventId }) => eventId === "entry-descent-landing");

  it("lets the first Turn afford an orbiter or a lander on the first Launch Vehicle", () => {
    expect(real.validatePlan(start, orbiterPlan).problems).toEqual([]);
    expect(real.validatePlan(start, landerPlan).problems).toEqual([]);
  });

  it("makes landing straight away clearly riskier than after a Turn of Surveys, but still plausible", () => {
    const { program } = succeeding.runTurn(start, orbiterPlan);
    const [site] = files.landingSites;
    expect(site?.landingRisk).toBeLessThan(0.5);
    expect(site?.surveyedLandingRisk).toBeLessThan(
      (site?.landingRisk ?? 0) / 2,
    );
    expect(landingBand(start)?.riskBand).toBe("Over 30%");
    expect(landingBand(program)?.riskBand).toBe("~10%");
  });

  it.each([
    ["orbiter", orbiterPlan],
    ["lander", landerPlan],
  ])("can afford a retry of either kind after a failed first %s", (_, plan) => {
    const { program } = failing.runTurn(failing.startProgram(1), plan);
    expect(failing.validatePlan(program, orbiterPlan).problems).toEqual([]);
    expect(failing.validatePlan(program, landerPlan).problems).toEqual([]);
  });

  it("pays off a landing after a first orbiter in Science, Public Support and money", () => {
    const first = succeeding.runTurn(succeeding.startProgram(1), orbiterPlan);
    expect(succeeding.validatePlan(first.program, landerPlan).problems).toEqual(
      [],
    );
    const second = succeeding.runTurn(first.program, landerPlan);
    expect(second.summary.scienceGained).toBeGreaterThan(
      first.summary.scienceGained,
    );
    expect(second.summary.publicSupportGained).toBeGreaterThan(0);
    expect(second.summary.fundingPayouts).toEqual([files.fundingThresholds[1]]);
    expect(second.summary.moneyEndMillions).toBeGreaterThan(
      second.summary.moneyStartMillions,
    );
  });

  it("still pays off a landing that succeeds on the retry after a crash", () => {
    const first = succeeding.runTurn(succeeding.startProgram(1), orbiterPlan);
    const crash = failing.runTurn(first.program, landerPlan);
    expect(crash.summary.failure).not.toBeNull();
    const retry = succeeding.runTurn(crash.program, landerPlan);
    expect(retry.summary.fundingPayouts).toEqual([files.fundingThresholds[1]]);
  });

  it("doesn't reach the second Funding Threshold with one Milestone from the start", () => {
    const { summary } = succeeding.runTurn(
      succeeding.startProgram(1),
      landerPlan,
    );
    expect(summary.fundingPayouts).toEqual([files.fundingThresholds[0]]);
  });

  it("doesn't let Reliability buy out a Survey: the best level on an unsurveyed site only matches none on a surveyed one", () => {
    const { program } = succeeding.runTurn(start, orbiterPlan);
    const unsurveyed = landingBand(start)?.reliabilityLevels.at(-1)?.riskBand;
    expect(unsurveyed).toBe(landingBand(program)?.riskBand);
  });

  it("leaves no retry of a lander after the best Reliability on its landing", () => {
    const plan: TurnPlan = {
      mission: {
        launchVehicleId: medium?.id ?? "",
        assetIds: [landerId],
        landingSiteId: "jezero-crater",
        reliability: { "entry-descent-landing": "redundant" },
      },
    };
    const { program } = failing.runTurn(failing.startProgram(1), plan);
    expect(failing.validatePlan(program, landerPlan).problems).toHaveLength(1);
    expect(failing.validatePlan(program, orbiterPlan).problems).toEqual([]);
  });

  it("reaches the second Funding Threshold in either order", () => {
    const first = succeeding.runTurn(succeeding.startProgram(1), landerPlan);
    const second = succeeding.runTurn(first.program, orbiterPlan);
    expect(second.summary.fundingPayouts).toEqual([files.fundingThresholds[1]]);
  });

  it("makes carrying both possible, but no cheaper than two Missions and with no room for a retry", () => {
    const together = real.validatePlan(start, bothPlan);
    expect(together.problems).toEqual([]);
    const separately =
      real.validatePlan(start, orbiterPlan).costMillions +
      real.validatePlan(start, landerPlan).costMillions;
    expect(together.costMillions).toBeGreaterThanOrEqual(separately);
    expect(
      real
        .validatePlan(start, {
          mission: {
            launchVehicleId: medium?.id ?? "",
            assetIds: [orbiterId, landerId],
            landingSiteId: "jezero-crater",
          },
        })
        .problems.join(" "),
    ).toMatch(/tonnes/);
    const failed = failing.runTurn(failing.startProgram(1), bothPlan);
    expect(
      failing.validatePlan(failed.program, orbiterPlan).problems,
    ).toHaveLength(1);
  });

  it("makes a longer Service Life on an orbiter buy one more Survey, for a price", () => {
    const orbiter = files.assets.find(({ id }) => id === orbiterId);
    const [shortest, longer] = orbiter?.serviceLifeOptions ?? [];
    const surveys = (serviceLifeDays: number | undefined) => {
      const safe = createSimulation(
        parseCatalogue({
          ...files,
          assets: files.assets.map((asset) => ({
            ...asset,
            failureChancePerTurn: 0,
          })),
          missionEvents: files.missionEvents.map((event) => ({
            ...event,
            failureProbability: 0,
          })),
        }),
      );
      let { program, summary } = safe.runTurn(safe.startProgram(1), {
        mission: {
          launchVehicleId: medium?.id ?? "",
          assetIds: [orbiterId],
          assetChoices: {
            [orbiterId]: { serviceLifeDays: serviceLifeDays ?? 0 },
          },
        },
      });
      let count = 0;
      for (let turn = 0; turn < 6 && summary.survey; turn++) {
        count++;
        ({ program, summary } = safe.runTurn(program, { mission: null }));
      }
      return count;
    };
    expect(longer?.costMillions).toBeGreaterThan(shortest?.costMillions ?? 0);
    expect(surveys(longer?.days)).toBe(surveys(shortest?.days) + 1);
  });

  it("makes Reliability for an Asset lower its risk, for a price, without being needed to play", () => {
    const [asset] = real.previewAssets({
      launchVehicleId: medium?.id ?? "",
      assetIds: [orbiterId],
    });
    expect(asset?.riskBand).toBe("~10%");
    // Each level is visibly better than the one below it, so that none is money for nothing.
    expect(asset?.reliabilityLevels.map(({ riskBand }) => riskBand)).toEqual([
      "~10%",
      "~5%",
      "~2%",
    ]);
    expect(asset?.reliabilityLevels.at(-1)?.costMillions).toBeGreaterThan(0);
  });

  it("still cancels after two failures in a row with landers", () => {
    const first = failing.runTurn(failing.startProgram(1), landerPlan);
    const second = failing.runTurn(first.program, landerPlan);
    expect(failing.readProgram(second.program).status.kind).toBe("cancelled");
  });
});
