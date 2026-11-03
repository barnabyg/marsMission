import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation, type Program, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { skipTurn, steadyHealth } from "./testHelpers";

const landingCrew = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2, landsAtSite: true },
  landingSiteId: "alpha-plain",
};
const landCrew: TurnPlan = { mission: landingCrew };
const stormDecision = "dust-storm:alpha-plain";

/**
 * The Test Catalogue with nothing failing or crashing, a 100-day dust storm over every Landing Site in every Turn if `stormy`, and
 * Crew who lose Health at these rates, and are hurt by a storm they carry on through at this chance.
 */
function simulationWith({
  stormy,
  health = steadyHealth,
  hurtChance = 1,
}: {
  stormy: boolean;
  health?: CatalogueFiles["crew"]["health"];
  hurtChance?: number;
}) {
  const files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      // A landing still goes by its site's risk, which is none, so that a storm over it brings a go/no-go check.
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability:
          event.failureProbability === "landingSite" ? "landingSite" : 0,
      })),
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk: 0,
      })),
      crew: {
        ...files.crew,
        health: { ...health, dustStorm: { chance: hurtChance, loss: 30 } },
      },
      hazards: {
        ...files.hazards,
        dustStorm: {
          ...files.hazards.dustStorm,
          chancePerSitePerTurn: stormy ? 1 : 0,
        },
      },
    }),
  );
}

const calm = simulationWith({ stormy: false });
const stormy = simulationWith({ stormy: true });

/** A Program with Crew landed at Alpha Plain in the first Turn, as the second starts. */
const crewLanded = (simulation = calm): Program =>
  simulation.runTurn(simulation.startProgram(42), landCrew).program;

describe("a dust storm over Crew at their Landing Site", () => {
  it("raises the same Decision Point as for Assets there, naming the Crew and what carrying on risks", () => {
    const { decisionPoint } = stormy.workOutTurn(crewLanded(), skipTurn);
    expect(decisionPoint).toMatchObject({
      id: stormDecision,
      kind: "dustStorm",
      siteName: "Alpha Plain",
      assets: ["Ann Able", "Ben Baker"],
    });
    const [shelter, carryOn] = decisionPoint?.choices ?? [];
    // Two Crew at 156 Science a Turn each, for 100 of its 780 days.
    expect(shelter?.description).toContain(
      "That gives up 40 Science, 0 Public Support and $0M of Research Grants.",
    );
    expect(carryOn).toMatchObject({ answer: "carryOn", riskBand: "Over 10%" });
    expect(carryOn?.description).toContain(
      "each Crew member a Over 10% chance of being hurt, which costs 30 Health",
    );
  });

  it("earns the Crew nothing for the storm's days if they shelter, and costs them no Health", () => {
    const { summary, program } = stormy.runTurn(crewLanded(), skipTurn, {
      [stormDecision]: "shelter",
    });
    // 680 of the Turn's 780 days, at 156 a Turn for each of the two.
    expect(summary.ongoingResearch).toEqual([
      {
        assetName: "Crew in Alpha Plain",
        activityName: "Test traverse",
        science: 2 * 136,
        publicSupport: 0,
        days: 680,
      },
    ]);
    expect(summary.healthLost).toEqual([]);
    expect(summary.dustStorms).toEqual([
      {
        siteName: "Alpha Plain",
        days: 100,
        answer: "shelter",
        assets: ["Ann Able", "Ben Baker"],
        assetsFailed: [],
        crewHurt: [],
      },
    ]);
    expect(
      stormy.readProgram(program).crew[0]?.members.map(({ health }) => health),
    ).toEqual([100, 100]);
  });

  it("keeps the Crew earning if they carry on, at the chance in the data files of each losing Health", () => {
    const { summary, program, timeline } = stormy.runTurn(
      crewLanded(),
      skipTurn,
      { [stormDecision]: "carryOn" },
    );
    expect(summary.ongoingResearch[0]).toMatchObject({
      science: 2 * 156,
      days: 780,
    });
    expect(summary.healthLost).toEqual([
      { name: "Ann Able", lost: [{ cause: "dustStorm", health: 30 }] },
      { name: "Ben Baker", lost: [{ cause: "dustStorm", health: 30 }] },
    ]);
    expect(summary.dustStorms[0]?.crewHurt).toEqual(["Ann Able", "Ben Baker"]);
    expect(
      stormy.readProgram(program).crew[0]?.members.map(({ health }) => health),
    ).toEqual([70, 70]);
    expect(
      timeline.entries.find(({ title }) => title.endsWith("has passed"))
        ?.description,
    ).toBe("Hurt by it: Ann Able and Ben Baker, who lost 30 Health each.");
  });

  it("hurts no one who is lucky, at a chance of none", () => {
    const lucky = simulationWith({ stormy: true, hurtChance: 0 });
    const { summary } = lucky.runTurn(crewLanded(), skipTurn, {
      [stormDecision]: "carryOn",
    });
    expect(summary.healthLost).toEqual([]);
    expect(summary.dustStorms[0]?.crewHurt).toEqual([]);
  });

  it("loses the Crew whose Health it takes the rest of, as Health running out does", () => {
    // 74 lost to 575 days at Mars in the first Turn leaves 26, less than being hurt costs.
    const wearing = simulationWith({
      stormy: false,
      health: { ...steadyHealth, timeAtMarsPerDay: 0.13 },
    });
    const { summary, program } = stormy.runTurn(crewLanded(wearing), skipTurn, {
      [stormDecision]: "carryOn",
    });
    // Each is hurt on a day of their own.
    expect(summary.crewLost.flatMap(({ names }) => names).toSorted()).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
    for (const { cause, description } of summary.crewLost) {
      expect(cause).toBe("health");
      expect(description).toContain(
        "in Alpha Plain, when their Health ran out",
      );
    }
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "dustStorm", health: 26 }],
    });
    expect(stormy.readProgram(program).crew).toEqual([]);
  });

  it("raises no Decision Point over Crew in Mars orbit", () => {
    const inOrbit = calm.runTurn(calm.startProgram(42), {
      mission: {
        launchVehicleId: "test-heavy",
        assetIds: [],
        crew: { size: 2 },
      },
    }).program;
    expect(stormy.workOutTurn(inOrbit, skipTurn).decisionPoint).toBeNull();
  });
});

/** The landing is due 5 days after the 200-day Slow Trajectory arrives. */
const landingDay = 205;

/** A seed whose storm over Alpha Plain is there when the Crew's landing is due. */
const stormOnLandingSeed = (() => {
  for (let seed = 1; seed < 5000; seed++) {
    const storm = stormy
      .workOutTurn(stormy.startProgram(seed), skipTurn)
      .timeline.dustStorms.find(({ siteName }) => siteName === "Alpha Plain");
    if (storm && storm.fromDay <= landingDay && landingDay < storm.toDay) {
      return { seed, toDay: storm.toDay };
    }
  }
  throw new Error("No seed has a storm over the landing");
})();

describe("a Crew landing due in a dust storm", () => {
  it("gets the usual go/no-go check, naming the Crew", () => {
    const { decisionPoint } = stormy.workOutTurn(
      stormy.startProgram(stormOnLandingSeed.seed),
      landCrew,
    );
    expect(decisionPoint).toMatchObject({
      id: "go-no-go:test-landing",
      kind: "goNoGo",
      day: landingDay,
      assets: ["Ann Able", "Ben Baker"],
    });
    expect(decisionPoint?.choices[1]?.description).toContain(
      "Waiting costs nothing but time, and research starts later.",
    );
  });

  it("lands the Crew once the storm has passed if it holds off, costing them nothing else", () => {
    const { program, summary, timeline } = stormy.runTurn(
      stormy.startProgram(stormOnLandingSeed.seed),
      landCrew,
      { "go-no-go:test-landing": "holdOff", [stormDecision]: "shelter" },
    );
    expect(summary.goNoGo).toMatchObject({
      answer: "holdOff",
      serviceLifeDaysLost: 0,
    });
    expect(
      timeline.entries.find(({ kind }) => kind === "crewArrived")?.day,
    ).toBe(stormOnLandingSeed.toDay);
    expect(summary.healthLost).toEqual([]);
    expect(stormy.readProgram(program).crew[0]?.locationName).toBe(
      "Alpha Plain",
    );
  });
});
