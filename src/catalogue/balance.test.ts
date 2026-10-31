import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playProgram, type TurnRecord } from "../balance/playProgram";
import { strategies } from "../balance/strategies";
import { parseCatalogue } from "./catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
} from "../simulation/simulation";
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

describe("Research Grants in the real data files", () => {
  const paidPerTurn = (assetId: string) =>
    succeeding
      .previewAssets({ ...mission, assetIds: [assetId] })[0]
      ?.activities.flatMap(
        ({ earnsPerTurn }) => earnsPerTurn?.researchGrantMillions ?? [],
      );

  it("pay nothing for an orbiter's research", () => {
    expect(paidPerTurn("pathfinder-orbiter")).toEqual([0]);
  });

  it("pay a lander's research a small part of what the lander costs", () => {
    const [paid] = paidPerTurn("prospector-lander") ?? [];
    expect(paid).toBeGreaterThan(0);
    expect(paid).toBeLessThan(
      (files.assets.find(({ id }) => id === "prospector-lander")
        ?.costMillions ?? 0) / 10,
    );
  });
});

describe("the rover in the real data files", () => {
  const files = realCatalogueFiles();
  const assetOfKind = (kind: string) =>
    files.assets.find((asset) => asset.kind === kind);
  const earnings = (id: string) =>
    succeeding
      .previewAssets({
        ...mission,
        assetIds: [assetOfKind("rover")?.id ?? ""],
      })[0]
      ?.activities.find((activity) => activity.id === id)?.earnsPerTurn;

  it("costs and weighs more than a lander, but both land together on the larger Launch Vehicle", () => {
    const rover = assetOfKind("rover");
    const lander = assetOfKind("lander");
    expect(rover?.costMillions).toBeGreaterThan(lander?.costMillions ?? 0);
    expect(rover?.massTonnes).toBeGreaterThan(lander?.massTonnes ?? 0);
    const heavy = files.launchVehicles.at(-1);
    expect(
      (rover?.massTonnes ?? 0) + (lander?.massTonnes ?? 0),
    ).toBeLessThanOrEqual(heavy?.capacityTonnes ?? 0);
  });

  it("chooses between Science and a Research Grant", () => {
    const soil = earnings("soil-analysis");
    const traverse = earnings("long-traverse");
    expect(soil?.science).toBeLessThan(traverse?.science ?? 0);
    expect(soil?.researchGrantMillions).toBeGreaterThan(0);
    expect(traverse?.researchGrantMillions).toBe(0);
  });
});

describe("a productive Program in the real data files", () => {
  // Nothing fails, so that the Program only shows what the numbers can reach.
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
  const start = safe.startProgram(1);
  const vehicles = safe.readProgram(start).launchVehicles;

  /** A Mission carrying this Asset, for this Service Life and on the Activity that earns the most Science. */
  function missionWith(
    program: Program,
    asset: (typeof files.assets)[number],
    serviceLifeDays: number,
  ): TurnPlan {
    const sites = safe.readProgram(program).landingSites;
    const site = sites.find(({ landed }) => !landed) ?? sites[0];
    const mission = {
      launchVehicleId:
        vehicles.find(
          ({ capacityTonnes }) => capacityTonnes >= asset.massTonnes,
        )?.id ?? "",
      assetIds: [asset.id],
      ...(asset.landsAtSite ? { landingSiteId: site?.id ?? "" } : {}),
    };
    const best = safe
      .previewAssets(mission)[0]
      ?.activities.toSorted(
        (first, second) =>
          (second.earnsPerTurn?.science ?? 0) -
          (first.earnsPerTurn?.science ?? 0),
      )[0];
    return {
      mission: {
        ...mission,
        assetChoices: {
          [asset.id]: {
            activityId: best?.id ?? "",
            serviceLifeDays,
          },
        },
      },
    };
  }

  /** A first orbiter for its Surveys, and then the dearest thing that lands that the money allows, at a new site if there is one. */
  function nextPlan(program: Program): TurnPlan {
    const { turnNumber } = safe.readProgram(program);
    const choices = files.assets
      .filter(({ landsAtSite, kind }) =>
        turnNumber === 1 ? kind === "orbiter" : landsAtSite,
      )
      .toSorted((first, second) => second.costMillions - first.costMillions)
      .flatMap((asset) =>
        asset.serviceLifeOptions
          .toSorted((first, second) => second.days - first.days)
          .map(({ days }) => missionWith(program, asset, days)),
      );
    return (
      choices.find(
        (plan) => safe.validatePlan(program, plan).problems.length === 0,
      ) ?? { mission: null }
    );
  }

  function play(turns: number) {
    let program = start;
    const paid: number[] = [];
    for (let turn = 0; turn < turns; turn++) {
      if (safe.readProgram(program).status.kind !== "active") break;
      const result = safe.runTurn(program, nextPlan(program));
      program = result.program;
      paid.push(
        ...result.summary.fundingPayouts.map(
          ({ publicSupport }) => publicSupport,
        ),
      );
    }
    return { paid, view: safe.readProgram(program) };
  }

  const played = play(20);

  it.each(files.fundingThresholds)(
    "reaches the Funding Threshold at $publicSupport Public Support",
    ({ publicSupport }) => {
      expect(played.paid).toContain(publicSupport);
    },
  );

  it.each(files.milestones)("earns the Milestone $name", ({ id }) => {
    expect(played.view.milestones.map((milestone) => milestone.id)).toContain(
      id,
    );
  });
});

describe("the balance of Phase 4", () => {
  const real = createSimulation(parseCatalogue(files));
  const programs = 300;

  /** Means over many seeds of a strategy from the balance runs, so these tests read like the balance report. */
  function played(name: string) {
    const strategy = strategies.find((candidate) => candidate.name === name);
    if (!strategy) throw new Error(`Expected the strategy "${name}"`);
    const plays = Array.from(
      { length: programs },
      (_, index) => playProgram(real, strategy, index + 1, 20).turns,
    );
    const meanOf = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    const ends = (read: (turn: TurnRecord) => number) =>
      meanOf(plays.flatMap((play) => play.at(-1) ?? []).map(read));
    const firstReached = (level: number) =>
      meanOf(
        plays.flatMap((play) => {
          const index = play.findIndex(({ thresholdsReached }) =>
            thresholdsReached.includes(level),
          );
          return index < 0 ? [] : [index + 1];
        }),
      );
    return {
      plays,
      science: ends(({ science }) => science),
      money: ends(({ moneyMillions }) => moneyMillions),
      cancelled: ends(({ cancelled }) => Number(cancelled)),
      firstReached,
      /** The income from each source over these Turns, counted from 1. */
      income(turnNumbers: number[]) {
        const turns = plays.flatMap((play) =>
          turnNumbers.flatMap((number) => play[number - 1] ?? []),
        );
        const total = (read: (turn: TurnRecord) => number) =>
          turns.reduce((sum, turn) => sum + read(turn), 0);
        return {
          thresholds: total(({ thresholdMillions }) => thresholdMillions),
          grants: total(({ researchGrantMillions }) => researchGrantMillions),
        };
      },
    };
  }
  const steady = played("steady: Soil analysis");
  const upToTurn = (last: number) =>
    Array.from({ length: last }, (_, index) => index + 1);

  it("has Funding Thresholds pay most at first, and Research Grants overtake them in a Program that keeps Assets at Mars", () => {
    const opening = steady.income(upToTurn(3));
    expect(opening.thresholds).toBeGreaterThan(2 * opening.grants);
    const soFar = steady.income(upToTurn(10));
    expect(soFar.grants).toBeGreaterThan(soFar.thresholds);
    const later = steady.income([11, 12, 13, 14, 15]);
    expect(later.grants).toBeGreaterThan(2 * later.thresholds);
  });

  it("pays little or nothing for early research, and real money for better kinds", () => {
    const paidFor = (assetId: string, activityId: string) =>
      real
        .previewAssets({ ...mission, assetIds: [assetId] })[0]
        ?.activities.find(({ id }) => id === activityId)?.earnsPerTurn
        ?.researchGrantMillions ?? 0;
    const orbital = paidFor("pathfinder-orbiter", "orbital-research");
    const surface = paidFor("prospector-lander", "surface-research");
    const soil = paidFor("trailblazer-rover", "soil-analysis");
    expect(orbital).toBe(0);
    expect(surface).toBeGreaterThan(0);
    expect(soil).toBeGreaterThan(10 * surface);
    // Over its longest Service Life, a rover that lasts pays for itself.
    const rover = files.assets.find(({ id }) => id === "trailblazer-rover");
    const longest = rover?.serviceLifeOptions.at(-1);
    const [vehicle] = files.launchVehicles;
    expect(
      (soil * (longest?.days ?? 0)) / files.program.launchWindowIntervalDays,
    ).toBeGreaterThan(
      (rover?.costMillions ?? 0) +
        (longest?.costMillions ?? 0) +
        (vehicle?.costMillions ?? 0),
    );
  });

  describe("with nothing failing and only Ongoing Research for Public Support", () => {
    const quiet = createSimulation(
      parseCatalogue({
        ...files,
        program: { ...files.program, startingMoneyMillions: 100_000 },
        milestones: files.milestones.map((milestone) => ({
          ...milestone,
          publicSupport: 0,
        })),
        assets: files.assets.map((asset) => ({
          ...asset,
          failureChancePerTurn: 0,
          serviceLifeOptions: asset.serviceLifeOptions.map((option) => ({
            ...option,
            days: option.days * 100,
          })),
        })),
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 0,
        })),
      }),
    );

    function keepAssets(kind: string, activityId: string, launches: number) {
      const asset = files.assets.find((candidate) => candidate.kind === kind);
      let { program } = quiet.runTurn(quiet.startProgram(1), { mission: null });
      const paid: number[] = [];
      for (let turn = 0; turn < 30; turn++) {
        if (quiet.readProgram(program).status.kind !== "active") break;
        const site = quiet.readProgram(program).landingSites[turn % 2];
        const result = quiet.runTurn(program, {
          mission:
            turn < launches
              ? {
                  launchVehicleId: files.launchVehicles[0]?.id ?? "",
                  assetIds: [asset?.id ?? ""],
                  ...(asset?.landsAtSite
                    ? { landingSiteId: site?.id ?? "" }
                    : {}),
                  assetChoices: { [asset?.id ?? ""]: { activityId } },
                }
              : null,
        });
        program = result.program;
        paid.push(
          ...result.summary.fundingPayouts.map(
            ({ publicSupport }) => publicSupport,
          ),
        );
      }
      return { status: quiet.readProgram(program).status.kind, paid };
    }

    it.each([
      ["lander", "surface-research"],
      ["rover", "soil-analysis"],
      ["rover", "long-traverse"],
    ])(
      "keeps a Program above the Cancellation Level with one %s on %s",
      (kind, activityId) => {
        expect(keepAssets(kind, activityId, 1).status).toBe("active");
      },
    );

    it("doesn't keep a Program going with one orbiter, which only adds a little", () => {
      expect(keepAssets("orbiter", "orbital-research", 1).status).toBe(
        "cancelled",
      );
    });

    it("doesn't reach a new Funding Threshold, even with as many rovers as a Program can keep at the best rate", () => {
      const rover = files.assets.find(({ kind }) => kind === "rover");
      const mostAtOnce = Math.ceil(
        (rover?.serviceLifeOptions.at(-1)?.days ?? 0) /
          files.program.launchWindowIntervalDays,
      );
      const { paid, status } = keepAssets("rover", "long-traverse", mostAtOnce);
      expect(status).toBe("active");
      // The first is reached by a first Milestone in any real Program, so only the ones after it count as new.
      expect(paid.filter((level) => level > 250)).toEqual([]);
    });
  });

  it("lets a Program that stops launching, with nothing left, fade to cancellation", () => {
    expect(played("stop after Turn 4").cancelled).toBe(1);
    expect(played("launch nothing").cancelled).toBe(1);
  });

  it("has Survey and research on an orbiter compete until nothing is left to Survey", () => {
    const once = played("steady: Survey once");
    // Close enough either way to be a choice, which a Survey doesn't simply win or lose.
    expect(once.science / steady.science).toBeGreaterThan(0.85);
    expect(once.science / steady.science).toBeLessThan(1.15);
    // The same goes for a Program that never Surveys at all and lands at greater risk.
    const neverSurveys = played("research orbiter, then land");
    const surveys = played("survey first");
    expect(neverSurveys.science / surveys.science).toBeGreaterThan(0.75);
    expect(neverSurveys.science / surveys.science).toBeLessThan(1.25);
  });

  it("makes Soil analysis and Long traverse each worth choosing sometimes", () => {
    const traverse = played("steady: Long traverse");
    const rich = played("steady: Soil, traverse when rich");
    const nextLevel = files.fundingThresholds[3]?.publicSupport ?? 0;
    // Long traverse gets to the Science Milestones and their Funding Thresholds sooner.
    expect(traverse.firstReached(nextLevel)).toBeLessThan(
      steady.firstReached(nextLevel),
    );
    // Soil analysis pays for more rovers, and so ends with more of both.
    expect(steady.money).toBeGreaterThan(traverse.money);
    expect(steady.science).toBeGreaterThan(traverse.science);
    // Once the money is there, changing to Long traverse earns the most Science.
    expect(rich.science).toBeGreaterThan(steady.science);
    expect(rich.money).toBeLessThan(steady.money);
  });

  it("makes a longer Service Life worth buying on a rover, and not on everything", () => {
    const shortest = played("steady: shortest Service Life");
    expect(steady.science).toBeGreaterThan(shortest.science);
    expect(steady.money).toBeGreaterThan(shortest.money);
    const everything = played("steady: longest on everything");
    expect(steady.science).toBeGreaterThan(everything.science);
    expect(steady.money).toBeGreaterThan(everything.money);
  });

  it("makes Reliability worth buying for a long-lived rover, and not for everything or a short-lived one", () => {
    const tested = played("steady: Tested rovers");
    expect(tested.money).toBeGreaterThan(steady.money);
    expect(tested.science).toBeGreaterThan(steady.science);
    const everything = played("steady: Tested everything");
    expect(everything.money).toBeLessThan(steady.money);
    const shortest = played("steady: shortest Service Life");
    const shortestTested = played("steady: shortest, Tested");
    expect(shortestTested.money).toBeLessThan(shortest.money);
    expect(shortestTested.science).toBeLessThan(shortest.science);
  });

  it("makes the opening a choice: Surveying is safer, and a rover straight away pays most when it works", () => {
    const worked = (strategy: ReturnType<typeof played>) =>
      strategy.plays.filter(
        (play) =>
          play.find(({ launched }) => launched)?.missionFailed === false,
      );
    const scienceOf = (plays: TurnRecord[][]) =>
      plays.reduce((total, play) => total + (play.at(-1)?.science ?? 0), 0) /
      plays.length;
    const gamble = played("steady: rover straight away");
    expect(gamble.cancelled).toBeGreaterThan(steady.cancelled);
    expect(worked(gamble).length).toBeLessThan(worked(steady).length);
    expect(scienceOf(worked(gamble))).toBeGreaterThan(
      scienceOf(worked(steady)),
    );
  });

  it("keeps operating an Asset whose Service Life is no longer on offer, as a save can hold", () => {
    const first = succeeding.runTurn(succeeding.startProgram(1), plainMission);
    const [orbiter] = first.program.operatingAssets;
    if (!orbiter) throw new Error("Expected the orbiter to arrive");
    // 900 days was on offer for this orbiter in Phase 3.
    const saved: Program = {
      ...first.program,
      operatingAssets: [{ ...orbiter, serviceLifeDays: 900 }],
    };
    const options = files.assets[0]?.serviceLifeOptions.map(({ days }) => days);
    expect(options).not.toContain(900);
    expect(succeeding.readProgram(saved).operatingAssets[0]?.daysLeft).toBe(
      330,
    );
    const { summary } = succeeding.runTurn(saved, { mission: null });
    expect(summary.assetsEnded).toEqual([orbiter.name]);
    expect(summary.survey).not.toBeNull();
  });
});

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
