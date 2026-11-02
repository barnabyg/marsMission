import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import { createSimulation, type Program, type TurnPlan } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";

type Files = ReturnType<typeof testCatalogueFiles>;

/** The Test Catalogue with a dust storm over every site in every Turn, and these landing risks. */
function stormy({
  landingRisk = 0,
  failing = [],
}: { landingRisk?: number; failing?: string[] } = {}) {
  const files: Files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk,
      })),
      missionEvents: files.missionEvents.map((event) => ({
        ...event,
        failureProbability:
          event.failureProbability === "landingSite"
            ? "landingSite"
            : failing.includes(event.id)
              ? 1
              : 0,
      })),
      contingencies: files.contingencies.map((contingency) => ({
        ...contingency,
        rescueFailureProbability: 0,
      })),
      hazards: {
        ...files.hazards,
        dustStorm: {
          ...files.hazards.dustStorm,
          chancePerSitePerTurn: 1,
          minDays: 60,
          maxDays: 120,
        },
      },
    }),
  );
}

const landing = {
  launchVehicleId: "test-vehicle",
  assetIds: ["test-lander"],
  landingSiteId: "alpha-plain",
  assetChoices: { "test-lander": { activityId: "test-research" } },
};
const land: TurnPlan = { mission: landing };
const decisionId = "go-no-go:test-landing";
/** The landing is due 5 days after the 200-day Slow Trajectory arrives. */
const landingDay = 205;

/** Seeds whose storm over Alpha Plain is, or isn't, there when the landing is due. */
function seeds(simulation: ReturnType<typeof stormy>, overLanding: boolean) {
  const found: number[] = [];
  for (let seed = 1; found.length < 5 && seed < 5000; seed++) {
    const { timeline } = simulation.workOutTurn(simulation.startProgram(seed), {
      mission: null,
    });
    const storm = timeline.dustStorms.find(
      ({ siteName }) => siteName === "Alpha Plain",
    );
    const over =
      storm !== undefined &&
      storm.fromDay <= landingDay &&
      landingDay < storm.toDay;
    if (over === overLanding) found.push(seed);
  }
  return found;
}

function stormOver(program: Program, simulation: ReturnType<typeof stormy>) {
  const storm = simulation
    .workOutTurn(program, { mission: null })
    .timeline.dustStorms.find(({ siteName }) => siteName === "Alpha Plain");
  if (!storm) throw new Error("Expected a storm over Alpha Plain");
  return storm;
}

describe("a go/no-go check", () => {
  it("fires for a landing due during a storm over its own Landing Site", () => {
    const simulation = stormy({ landingRisk: 0.04 });
    for (const seed of seeds(simulation, true)) {
      const program = simulation.startProgram(seed);
      const storm = stormOver(program, simulation);
      const { decisionPoint, timeline } = simulation.workOutTurn(program, land);
      expect(decisionPoint).toMatchObject({
        id: decisionId,
        kind: "goNoGo",
        day: landingDay,
        siteName: "Alpha Plain",
        assets: ["Test Lander"],
      });
      const [go, holdOff] = decisionPoint?.choices ?? [];
      expect(go).toMatchObject({ answer: "go", riskBand: "~10%" });
      expect(holdOff).toMatchObject({ answer: "holdOff", riskBand: "~5%" });
      expect(holdOff?.description).toContain(
        `${storm.toDay - landingDay} days`,
      );
      expect(timeline.mission?.assets[0]?.deliveredOnDay).toBeNull();
    }
  });

  it("doesn't fire when the storm isn't there on the day", () => {
    const simulation = stormy();
    for (const seed of seeds(simulation, false)) {
      expect(
        simulation.workOutTurn(simulation.startProgram(seed), land, {
          "dust-storm:alpha-plain": "shelter",
        }).decisionPoint?.kind,
      ).not.toBe("goNoGo");
    }
  });

  it("doesn't fire for a storm over another Landing Site", () => {
    const simulation = stormy();
    const elsewhere: TurnPlan = {
      mission: { ...landing, landingSiteId: "beta-crater" },
    };
    for (const seed of seeds(simulation, true)) {
      const { decisionPoint } = simulation.workOutTurn(
        simulation.startProgram(seed),
        elsewhere,
      );
      expect(decisionPoint?.id).not.toBe(decisionId);
    }
  });

  it("doesn't fire for a Mission that doesn't land", () => {
    const simulation = stormy();
    const orbiter: TurnPlan = {
      mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
    };
    for (const seed of seeds(simulation, true)) {
      expect(
        simulation.workOutTurn(simulation.startProgram(seed), orbiter)
          .decisionPoint,
      ).toBeNull();
    }
  });
});

describe("answering a go/no-go check", () => {
  it("Go lands now, rolling at the raised risk", () => {
    // Risky enough that doubling it makes the roll fail on some seeds where the usual risk wouldn't.
    const simulation = stormy({ landingRisk: 0.4 });
    let crashedOnlyBecauseOfGo = 0;
    for (const seed of seeds(simulation, true)) {
      const program = simulation.startProgram(seed);
      const went = simulation.runTurn(program, land, { [decisionId]: "go" });
      const held = simulation.runTurn(program, land, {
        [decisionId]: "holdOff",
      });
      expect(went.summary.goNoGo).toEqual({
        siteName: "Alpha Plain",
        answer: "go",
        daysHeld: 0,
        serviceLifeDaysLost: 0,
      });
      const crashed = (summary: typeof went.summary) =>
        summary.failure !== null;
      // The same roll at a higher risk: going ahead can't land where holding off would crash.
      if (crashed(held.summary)) expect(crashed(went.summary)).toBe(true);
      if (crashed(went.summary) && !crashed(held.summary)) {
        crashedOnlyBecauseOfGo++;
      }
      if (!crashed(went.summary)) {
        expect(went.timeline.mission?.assets[0]?.deliveredOnDay).toBe(
          landingDay,
        );
      }
    }
    expect(crashedOnlyBecauseOfGo).toBeGreaterThan(0);
  });

  it("Hold off lands after the storm, moving delivery, research and Milestones, and costing Service Life", () => {
    const simulation = stormy();
    const [seed = 0] = seeds(simulation, true);
    const program = simulation.startProgram(seed);
    const storm = stormOver(program, simulation);
    const wait = storm.toDay - landingDay;
    const {
      summary,
      timeline,
      program: after,
    } = simulation.runTurn(program, land, { [decisionId]: "holdOff" });
    expect(summary.goNoGo).toEqual({
      siteName: "Alpha Plain",
      answer: "holdOff",
      daysHeld: wait,
      serviceLifeDaysLost: wait,
    });
    const landed = timeline.entries.find(
      (entry) =>
        entry.kind === "missionEvent" && entry.eventId === "test-landing",
    );
    expect(landed?.day).toBe(storm.toDay);
    expect(timeline.mission?.assets[0]?.deliveredOnDay).toBe(storm.toDay);
    expect(timeline.assetsAtMars[0]?.fromDay).toBe(storm.toDay);
    expect(summary.ongoingResearch[0]?.days).toBe(780 - storm.toDay);
    expect(
      timeline.entries
        .filter(
          (entry) =>
            entry.kind === "milestone" || entry.kind === "firstLanding",
        )
        .every((entry) => entry.day === storm.toDay),
    ).toBe(true);
    expect(summary.milestones.length).toBeGreaterThan(0);
    // The shortest Service Life is 50,000 days, less a day for each day held.
    expect(after.operatingAssets[0]?.serviceLifeDays).toBe(50_000 - wait);
    expect(timeline.assetsAtMars[0]?.cutServiceLifeDays).toBe(50_000 - wait);
    expect(
      timeline.entries.some(
        (entry) =>
          entry.kind === "hazard" &&
          entry.day === landingDay &&
          entry.title.startsWith("Holding off"),
      ),
    ).toBe(true);
  });

  it("keeps the later landing and the shorter Service Life after saving and reloading", () => {
    const simulation = stormy();
    const [seed = 0] = seeds(simulation, true);
    const program = simulation.startProgram(seed);
    const storm = stormOver(program, simulation);
    const after = simulation.runTurn(program, land, {
      [decisionId]: "holdOff",
    }).program;
    const reloaded = simulation.restoreProgram(
      JSON.parse(JSON.stringify(simulation.saveProgram(after))),
    );
    const [lander] = simulation.readProgram(reloaded).operatingAssets;
    expect(lander?.serviceLifeDays).toBe(50_000 - (storm.toDay - landingDay));
    expect(lander?.daysLeft).toBe(
      50_000 - (storm.toDay - landingDay) - (780 - storm.toDay),
    );
  });

  it("still lets a Contingency for the landing save it, whichever answer was given", () => {
    const simulation = stormy({ landingRisk: 1 });
    const insured: TurnPlan = {
      mission: { ...landing, contingencyIds: ["test-thrusters"] },
    };
    const [seed = 0] = seeds(simulation, true);
    const program = simulation.startProgram(seed);
    const storm = stormOver(program, simulation);
    for (const answer of ["go", "holdOff"] as const) {
      const { decisionPoint } = simulation.workOutTurn(program, insured, {
        [decisionId]: answer,
      });
      expect(decisionPoint).toMatchObject({
        id: "contingency:test-landing",
        day: answer === "go" ? landingDay : storm.toDay,
      });
      const saved = simulation.runTurn(program, insured, {
        [decisionId]: answer,
        "contingency:test-landing": "use",
      });
      expect(saved.summary.failure).toBeNull();
      expect(saved.summary.contingencies[0]?.rescued).toBe(true);
    }
  });
});

describe("the Catalogue's go/no-go numbers", () => {
  const parseWith = (dustStorm: Partial<Files["hazards"]["dustStorm"]>) => {
    const files = testCatalogueFiles();
    return () =>
      parseCatalogue({
        ...files,
        hazards: {
          ...files.hazards,
          dustStorm: { ...files.hazards.dustStorm, ...dustStorm },
        },
      });
  };

  it("refuses a storm that doesn't raise a landing's risk", () => {
    expect(parseWith({ landingRiskMultiplier: 1 })).toThrow(
      /landingRiskMultiplier/,
    );
  });

  it("refuses holding off for free", () => {
    expect(parseWith({ serviceLifeLostPerDayHeld: 0 })).toThrow(
      /serviceLifeLostPerDayHeld/,
    );
  });
});
