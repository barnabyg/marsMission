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
import {
  succeeding,
  files,
  mission,
  plainMission,
} from "../testing/realBalance";

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
