import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Program,
  type Simulation,
  type TurnPlan,
} from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendLander, skipTurn, withFailures } from "./testHelpers";

/*
 * The Test Fuel Plant makes 10 kg of ascent propellant a day at its Landing Site, 7,800 kg over a whole 780-day Turn,
 * whatever its Activity.
 */

/** The Test Catalogue with landings that never fail, and these changes to its files. */
function safeLandings(
  change: (files: CatalogueFiles) => Partial<CatalogueFiles> = () => ({}),
) {
  const files = testCatalogueFiles();
  return createSimulation(
    parseCatalogue({
      ...files,
      landingSites: files.landingSites.map((site) => ({
        ...site,
        landingRisk: 0,
      })),
      ...change(files),
    }),
  );
}

function setup() {
  const simulation = safeLandings();
  return { simulation, program: simulation.startProgram(42) };
}

const perDay = 10;
const turnDays = 780;

const sendFuelPlant = (landingSiteId = "alpha-plain"): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-fuel-plant"],
    landingSiteId,
  },
});

/** The ascent propellant at each known Landing Site, by name, as Planning Mode shows it. */
function propellantAt(simulation: Simulation, program: Program) {
  return Object.fromEntries(
    simulation
      .readProgram(program)
      .landingSites.map(({ name, ascentPropellantKg }) => [
        name,
        ascentPropellantKg,
      ]),
  );
}

/** The fuel plant landed on the first Turn, and the day it landed. */
function landed(simulation: Simulation = setup().simulation) {
  const result = simulation.runTurn(
    simulation.startProgram(42),
    sendFuelPlant(),
  );
  const landedOn =
    result.timeline.mission?.assets.find(({ kind }) => kind === "fuel-plant")
      ?.deliveredOnDay ?? null;
  if (landedOn === null) throw new Error("The fuel plant didn't land");
  return { ...result, landedOn };
}

describe("ascent propellant", () => {
  it("starts at none at every Landing Site", () => {
    const { simulation, program } = setup();
    expect(propellantAt(simulation, program)).toEqual({
      "Alpha Plain": 0,
      "Beta Crater": 0,
    });
  });

  it("is made at a fuel plant's Landing Site on each day it operates, from the day it lands", () => {
    const { simulation } = setup();
    const { program, landedOn } = landed(simulation);
    expect(propellantAt(simulation, program)).toEqual({
      "Alpha Plain": perDay * (turnDays - landedOn),
      "Beta Crater": 0,
    });
  });

  it("builds up from Turn to Turn", () => {
    const { simulation } = setup();
    const { program, landedOn } = landed(simulation);
    const next = simulation.runTurn(program, skipTurn).program;
    expect(propellantAt(simulation, next)["Alpha Plain"]).toBe(
      perDay * (turnDays - landedOn) + perDay * turnDays,
    );
  });

  it("stays at the site once the fuel plant's mission ends", () => {
    const { simulation } = setup();
    const { program } = landed(simulation);
    const [plant] = simulation.readProgram(program).operatingAssets;
    const next = simulation.runTurn(program, {
      mission: null,
      endedAssetKeys: [plant?.key ?? ""],
    }).program;
    expect(simulation.readProgram(next).operatingAssets).toEqual([]);
    expect(propellantAt(simulation, next)).toEqual(
      propellantAt(simulation, program),
    );
  });

  it("stops being made on the day the fuel plant's Service Life ends", () => {
    const simulation = safeLandings((files) => ({
      assets: files.assets.map((asset) =>
        asset.id === "test-fuel-plant"
          ? { ...asset, serviceLifeOptions: [{ days: 1000, costMillions: 0 }] }
          : asset,
      ),
    }));
    const { program, landedOn } = landed(simulation);
    const next = simulation.runTurn(program, skipTurn).program;
    // It operates for 1,000 days from the day it landed, then stops for good.
    expect(propellantAt(simulation, next)["Alpha Plain"]).toBe(perDay * 1000);
    expect(landedOn).toBeGreaterThan(0);
    const later = simulation.runTurn(next, skipTurn).program;
    expect(propellantAt(simulation, later)["Alpha Plain"]).toBe(perDay * 1000);
  });

  it("is made by each fuel plant at a site, so two make twice as much", () => {
    const { simulation } = setup();
    const { program, landedOn } = landed(simulation);
    const second = simulation.runTurn(program, sendFuelPlant());
    const secondOn =
      second.timeline.mission?.assets[0]?.deliveredOnDay ?? turnDays;
    expect(propellantAt(simulation, second.program)["Alpha Plain"]).toBe(
      perDay * (turnDays - landedOn) +
        perDay * turnDays +
        perDay * (turnDays - secondOn),
    );
  });

  it("is kept for each Landing Site apart", () => {
    const { simulation } = setup();
    const { program, landedOn } = landed(simulation);
    const second = simulation.runTurn(program, sendFuelPlant("beta-crater"));
    const secondOn =
      second.timeline.mission?.assets[0]?.deliveredOnDay ?? turnDays;
    expect(propellantAt(simulation, second.program)).toEqual({
      "Alpha Plain": perDay * (turnDays - landedOn) + perDay * turnDays,
      "Beta Crater": perDay * (turnDays - secondOn),
    });
  });

  it("isn't made by a fuel plant that crashed", () => {
    const { simulation, program } = withFailures(["test-landing"]);
    const next = simulation.runTurn(program, sendFuelPlant()).program;
    expect(propellantAt(simulation, next)["Alpha Plain"]).toBe(0);
  });

  it("isn't made by anything else that lands", () => {
    const { simulation, program } = setup();
    const next = simulation.runTurn(program, sendLander).program;
    expect(propellantAt(simulation, next)["Alpha Plain"]).toBe(0);
  });
});

describe("the Turn summary's ascent propellant", () => {
  it("reports what each Landing Site made, by which fuel plants, and what it has now", () => {
    const { summary, landedOn } = landed();
    expect(summary.ascentPropellant).toEqual([
      {
        siteName: "Alpha Plain",
        madeBy: ["Test Fuel Plant"],
        madeKg: perDay * (turnDays - landedOn),
        totalKg: perDay * (turnDays - landedOn),
      },
    ]);
  });

  it("reports nothing when no fuel plant operated", () => {
    const { simulation, program } = setup();
    expect(
      simulation.runTurn(program, sendLander).summary.ascentPropellant,
    ).toEqual([]);
  });
});

describe("the fuel plant's Benefit in Planning Mode", () => {
  it("says what it makes and how much over a whole Turn", () => {
    const { simulation, program } = setup();
    const plant = simulation
      .readProgram(program)
      .assets.find(({ id }) => id === "test-fuel-plant");
    expect(plant?.makes).toEqual({
      ascentPropellantKgPerTurn: perDay * turnDays,
    });
    expect(plant?.benefit).toContain("ascent propellant");
    expect(plant?.benefitImpact).toBeNull();
  });

  it("is only given by an Asset that makes something", () => {
    const { simulation, program } = setup();
    const lander = simulation
      .readProgram(program)
      .assets.find(({ id }) => id === "test-lander");
    expect(lander?.makes).toBeNull();
  });
});

describe("saving ascent propellant", () => {
  it("restores exactly the propellant that was saved", () => {
    const { simulation } = setup();
    const { program } = landed(simulation);
    const saved = JSON.parse(
      JSON.stringify(simulation.saveProgram(program)),
    ) as unknown;
    const restored = simulation.restoreProgram(saved);
    expect(restored).toEqual(program);
    expect(propellantAt(simulation, restored)["Alpha Plain"]).toBeGreaterThan(
      0,
    );
  });

  it("upgrades a save from before fuel plants with none at any Landing Site", () => {
    const { simulation } = setup();
    // A literal copy of what format 9 looks like. Don't change this: it's a compatibility contract.
    const formatNine = {
      formatVersion: 9,
      program: {
        seed: 1,
        turnNumber: 2,
        date: "2031-01-20",
        moneyMillions: 600,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [
          {
            assetId: "test-lander",
            name: "Test Lander",
            kind: "lander",
            arrivedOn: "2029-06-19",
            landingSiteId: "alpha-plain",
            serviceLifeDays: 50_000,
            reliabilityLevelId: "none",
            activityId: "test-research",
            flewUnproven: false,
          },
        ],
        crew: [],
        crewActivities: {},
        crewSupplies: {},
        earthReturnStages: [],
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatNine);
    expect(propellantAt(simulation, restored)).toEqual({
      "Alpha Plain": 0,
      "Beta Crater": 0,
    });
    const next = simulation.runTurn(restored, sendFuelPlant()).program;
    expect(propellantAt(simulation, next)["Alpha Plain"]).toBeGreaterThan(0);
  });
});

describe("ascent propellant in a dust storm", () => {
  // A 100-day storm over every Landing Site on every Turn, which never harms what carries on through it.
  const stormy = safeLandings((files) => ({
    hazards: {
      ...files.hazards,
      dustStorm: { ...files.hazards.dustStorm, chancePerSitePerTurn: 1 },
    },
  }));
  const calm = setup().simulation;
  const inPlace = calm.runTurn(calm.startProgram(42), sendFuelPlant()).program;
  const storm = "dust-storm:alpha-plain";

  it("isn't made on the storm's days by a fuel plant that shelters", () => {
    const sheltered = stormy.runTurn(inPlace, skipTurn, { [storm]: "shelter" });
    expect(sheltered.summary.ascentPropellant[0]?.madeKg).toBe(
      perDay * (turnDays - 100),
    );
  });

  it("is made on every day by a fuel plant that carries on", () => {
    const carried = stormy.runTurn(inPlace, skipTurn, { [storm]: "carryOn" });
    expect(carried.summary.ascentPropellant[0]?.madeKg).toBe(perDay * turnDays);
  });

  it("is what the Decision Point says sheltering gives up", () => {
    const { decisionPoint } = stormy.workOutTurn(inPlace, skipTurn);
    const shelter = decisionPoint?.choices.find(
      ({ answer }) => answer === "shelter",
    );
    // 1,000 kg, shown in tonnes.
    expect(shelter?.description).toContain("1.0 t of ascent propellant");
  });
});
