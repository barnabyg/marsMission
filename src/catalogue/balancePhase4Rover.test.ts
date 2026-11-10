import { describe, expect, it } from "vitest";
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

  /**
   * A first orbiter for its Surveys, and then the dearest thing that lands and does research that the money allows, at
   * a new site if there is one. A fuel plant, a habitat, a Mars lab and an ascent vehicle, which came in Phase 8, earn
   * nothing of their own.
   */
  function nextPlan(program: Program): TurnPlan {
    const { turnNumber } = safe.readProgram(program);
    const choices = files.assets
      .filter(({ landsAtSite, kind, makes, habitat, benefit, sampleReturn }) =>
        turnNumber === 1
          ? kind === "orbiter"
          : landsAtSite === true &&
            makes === undefined &&
            habitat === undefined &&
            benefit === undefined &&
            sampleReturn === undefined,
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

  // This Program flies no Crew, which came in Phase 7, and brings neither Crew nor samples home, which came in Phase 8.
  it.each(
    files.milestones.filter(
      ({ trigger }) =>
        !(
          "crewArrives" in trigger ||
          "crewLands" in trigger ||
          "crewComesHome" in trigger ||
          "samplesComeHome" in trigger
        ),
    ),
  )("earns the Milestone $name", ({ id }) => {
    expect(played.view.milestones.map((milestone) => milestone.id)).toContain(
      id,
    );
  });
});
