import { describe, expect, it } from "vitest";
import type { CatalogueFiles } from "../catalogue/catalogue";
import type { Program, Simulation, TurnPlan } from "./simulation";
import { skipTurn, withFailures } from "./testHelpers";

/*
 * The Test Habitat halves the Health that Crew at its Landing Site lose to time at Mars, 0.05 a day in the test
 * catalogue, and holds 400 kg of Supplies. Crew landing on the first Turn land on day 205, 575 days before it ends.
 */

const landingCrew = {
  launchVehicleId: "test-heavy",
  crew: { size: 2, landsAtSite: true },
  landingSiteId: "alpha-plain",
};
const landCrew: TurnPlan = { mission: { ...landingCrew, assetIds: [] } };
const crewWithHabitat: TurnPlan = {
  mission: { ...landingCrew, assetIds: ["test-habitat"] },
};
const sendHabitat = (landingSiteId = "alpha-plain"): TurnPlan => ({
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-habitat"],
    landingSiteId,
  },
});

/** Landings that never fail, money for several Missions, and Crew Health changed as given. */
const landingSafely = (crewHealth: Partial<CatalogueFiles["crew"]["health"]>) =>
  withFailures([], { startingMoneyMillions: 5000, crewHealth });

/** Crew who lose Health only to time at Mars. */
const onlyTimeAtMars = () =>
  landingSafely({ radiationPerDay: { inFlight: 0, atMars: 0 } });

/** The day of the Turn the habitat landed. */
function habitatLandedOn(simulation: Simulation, program: Program) {
  const result = simulation.runTurn(program, sendHabitat());
  const day = result.timeline.mission?.assets.find(
    ({ kind }) => kind === "habitat",
  )?.deliveredOnDay;
  if (day === undefined || day === null) throw new Error("It didn't land");
  return { ...result, day };
}

describe("a habitat at a Landing Site", () => {
  it("slows the Health Crew there lose to time at Mars, and the Turn summary says how much it saved", () => {
    const { simulation, program } = onlyTimeAtMars();
    const { summary } = simulation.runTurn(program, crewWithHabitat);
    // 0.05 a day for 575 days is 28, which the habitat halves to 14.
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: 14 }],
      savedByHabitat: 14,
    });
    expect(summary.crew.map(({ health }) => health)).toEqual([86, 86]);
  });

  it("slows nothing else, and Protection slows radiation beside it as before", () => {
    const { simulation, program } = landingSafely({});
    const shielded: TurnPlan = {
      mission: {
        ...landingCrew,
        assetIds: ["test-habitat"],
        crew: { ...landingCrew.crew, protectionId: "test-shielding" },
      },
    };
    const { summary } = simulation.runTurn(program, shielded);
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [
        { cause: "radiationInFlight", health: 10 },
        { cause: "radiationAtMars", health: 14 },
        { cause: "timeAtMars", health: 14 },
      ],
      savedByProtection: 10 + 14,
      savedByHabitat: 14,
    });
  });

  it("slows it only from the day the habitat lands beside Crew already there", () => {
    const { simulation, program } = onlyTimeAtMars();
    const there = simulation.runTurn(program, landCrew).program;
    const { summary, day } = habitatLandedOn(simulation, there);
    // A whole Turn would take 39, with the days after the habitat lands halved.
    const lost = Math.floor(0.05 * day + 0.025 * (780 - day));
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: lost }],
      savedByHabitat: 39 - lost,
    });
  });

  it("does nothing for Crew at another Landing Site", () => {
    const { simulation, program } = onlyTimeAtMars();
    const elsewhere = simulation.runTurn(
      program,
      sendHabitat("beta-crater"),
    ).program;
    const { summary } = simulation.runTurn(elsewhere, landCrew);
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: 28 }],
    });
  });

  it("doesn't add up with a second habitat at the same site", () => {
    const { simulation, program } = onlyTimeAtMars();
    const first = simulation.runTurn(program, sendHabitat()).program;
    const { summary } = simulation.runTurn(first, crewWithHabitat);
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: 14 }],
      savedByHabitat: 14,
    });
  });

  it("stops slowing it once the habitat's mission ends", () => {
    const { simulation, program } = onlyTimeAtMars();
    const there = simulation.runTurn(program, crewWithHabitat).program;
    const habitat = simulation
      .readProgram(there)
      .operatingAssets.find(({ kind }) => kind === "habitat");
    const { summary } = simulation.runTurn(there, {
      mission: null,
      endedAssetKeys: [habitat?.key ?? ""],
    });
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: 39 }],
    });
  });

  it("keeps slowing it while the Crew shelter from a dust storm", () => {
    const { simulation, program } = onlyTimeAtMars();
    const there = simulation.runTurn(program, crewWithHabitat).program;
    const stormy = withFailures([], {
      startingMoneyMillions: 5000,
      crewHealth: { radiationPerDay: { inFlight: 0, atMars: 0 } },
      dustStormsEveryTurn: true,
    });
    const { summary } = stormy.simulation.runTurn(there, skipTurn, {
      "dust-storm:alpha-plain": "shelter",
    });
    // Half of 0.05 a day for the whole Turn, storm and all.
    expect(summary.healthLost[0]).toEqual({
      name: "Ann Able",
      lost: [{ cause: "timeAtMars", health: 19 }],
      savedByHabitat: 39 - 19,
    });
  });
});

describe("the habitat's Benefit in Planning Mode", () => {
  it("says what it does and how many more days a Crew member would last beside it", () => {
    const { simulation, program } = landingSafely({});
    const { assets } = simulation.readProgram(program);
    const habitat = assets.find(({ id }) => id === "test-habitat");
    // 100 Health lasts 1,000 days at 0.1 a day, and 1,333 at 0.075 once time at Mars is halved.
    expect(habitat?.habitat).toEqual({
      timeAtMarsCutPercent: 50,
      suppliesKg: 400,
      extraDays: 333,
    });
    expect(habitat?.benefit).toContain("time at Mars");
    expect(habitat?.benefitImpact).toBeNull();
    expect(habitat?.makes).toBeNull();
  });

  it("is only given by a habitat", () => {
    const { simulation, program } = onlyTimeAtMars();
    const { assets } = simulation.readProgram(program);
    expect(
      assets.filter(({ habitat }) => habitat !== null).map(({ id }) => id),
    ).toEqual(["test-habitat"]);
  });
});
