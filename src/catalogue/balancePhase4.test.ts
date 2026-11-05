import { describe, expect, it } from "vitest";
import type { TurnRecord } from "../balance/playProgram";
import { parseCatalogue } from "./catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
} from "../simulation/simulation";
import { calmCatalogueFiles } from "../testing/realCatalogue";
import {
  failing,
  succeeding,
  files,
  mission,
  plainMission,
} from "../testing/realBalance";
import { played } from "../testing/playedStrategies";

describe("Research Grants in the real data files", () => {
  const paidPerTurn = (assetId: string) =>
    succeeding
      .previewAssets(succeeding.startProgram(1), {
        ...mission,
        assetIds: [assetId],
      })[0]
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
  const files = calmCatalogueFiles();
  const assetOfKind = (kind: string) =>
    files.assets.find((asset) => asset.kind === kind);
  const earnings = (id: string) =>
    succeeding
      .previewAssets(succeeding.startProgram(1), {
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

  /** The usual Mission, to Jezero Crater, carrying the Asset of this kind instead. */
  const landing = (kind: string): TurnPlan => ({
    mission: {
      ...mission,
      assetIds: [assetOfKind(kind)?.id ?? ""],
      landingSiteId: "jezero-crater",
    },
  });

  it("reaches the second Funding Threshold by itself on the first Turn", () => {
    const { summary } = succeeding.runTurn(
      succeeding.startProgram(1),
      landing("rover"),
    );
    expect(summary.fundingPayouts).toEqual(files.fundingThresholds.slice(0, 2));
  });

  it("leaves too little for a retry of anything if it fails on the first Turn", () => {
    // What the gamble left, before base funding, which pays for a retry in time.
    const { program: after, summary } = failing.runTurn(
      failing.startProgram(1),
      landing("rover"),
    );
    const program = {
      ...after,
      moneyMillions: after.moneyMillions - summary.baseFundingMillions,
    };
    expect(failing.validatePlan(program, plainMission).problems).toHaveLength(
      1,
    );
    expect(
      failing.validatePlan(program, landing("lander")).problems,
    ).toHaveLength(1);
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
      .previewAssets(safe.startProgram(1), mission)[0]
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

  // This Program flies no Crew, which came in Phase 7.
  it.each(
    files.milestones.filter(
      ({ trigger }) => !("crewArrives" in trigger || "crewLands" in trigger),
    ),
  )("earns the Milestone $name", ({ id }) => {
    expect(played.view.milestones.map((milestone) => milestone.id)).toContain(
      id,
    );
  });
});

describe("the balance of Phase 4", () => {
  const real = createSimulation(parseCatalogue(files));
  const steady = played("steady: Soil analysis");
  // Played here, as a test that plays several would take longer than a test may now that base funding keeps more
  // Programs going for longer.
  for (const name of [
    "steady: Tested rovers",
    "steady: Tested everything",
    "steady: shortest Service Life",
    "steady: shortest, Tested",
    "steady: Survey once",
    "research orbiter, then land",
    "survey first",
  ]) {
    played(name);
  }

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
        .previewAssets(real.startProgram(1), {
          ...mission,
          assetIds: [assetId],
        })[0]
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
    // Never Surveying at all is the bolder opening: since base funding rescues more Programs that Survey
    // first, landing at greater risk is cancelled far more often and earns less.
    const neverSurveys = played("research orbiter, then land");
    const surveys = played("survey first");
    expect(neverSurveys.cancelled).toBeGreaterThan(surveys.cancelled + 0.2);
    expect(neverSurveys.science).toBeLessThan(surveys.science);
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
    // Since base funding, Reliability on everything pays its way in money, but earns no more Science.
    const everything = played("steady: Tested everything");
    expect(everything.science).toBeLessThan(1.02 * steady.science);
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
