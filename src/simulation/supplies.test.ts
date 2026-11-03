import { describe, expect, it } from "vitest";
import type { TurnPlan } from "./simulation";
import { setup, skipTurn, steadyHealth, withFailures } from "./testHelpers";

const crewMission = {
  launchVehicleId: "test-heavy",
  assetIds: [],
  crew: { size: 2 },
};
const withSupplies = (suppliesId: string, size = 2): TurnPlan => ({
  mission: { ...crewMission, crew: { size, suppliesId } },
});
const sendLong = withSupplies("test-supplies-long");

/**
 * Crew who use Supplies this fast, whose Health falls only once they have none, by 1 a day, and two Turns' worth of
 * money.
 */
const usingSupplies = (kilogramsPerDay: number) =>
  withFailures([], {
    startingMoneyMillions: 5000,
    crewHealth: { ...steadyHealth, noSuppliesPerDay: 1 },
    suppliesPerMemberPerDayKg: kilogramsPerDay,
  });

describe("planning a Crewed Mission's Supplies", () => {
  it("previews each Supplies on offer with how long it lasts this Crew, so a larger Crew uses them faster", () => {
    const { simulation, program } = setup();
    const daysEach = (size: number) =>
      simulation
        .previewCrew(program, { ...crewMission, crew: { size } })
        ?.supplies.map(({ name, days }) => [name, days]);
    // Half a kilogram a day for two, and three-quarters for three, out of 1,000 kg and 2,000 kg.
    expect(daysEach(2)).toEqual([
      ["Short", 2000],
      ["Long", 4000],
    ]);
    expect(daysEach(3)).toEqual([
      ["Short", 1333],
      ["Long", 2666],
    ]);
    expect(simulation.previewCrew(program, crewMission)?.suppliesId).toBe(
      "test-supplies-short",
    );
  });

  it("adds the chosen Supplies' cost and mass to the Mission's", () => {
    const { simulation, program } = setup();
    expect(simulation.validatePlan(program, sendLong)).toMatchObject({
      costMillions: 300 + 1000 + 200,
      massTonnes: 6 + 2,
      problems: [],
    });
  });

  it("rejects Supplies that aren't on offer", () => {
    const { simulation, program } = setup();
    expect(
      simulation.validatePlan(program, withSupplies("caviar")).problems,
    ).toEqual([`There are no Supplies called "caviar".`]);
  });
});

describe("Supplies used up", () => {
  it("fall each day from launch, carrying on from Turn to Turn, and Planning Mode shows the days left", () => {
    const { simulation, program } = usingSupplies(1);
    // 2,000 kg, less 2 kg a day for 780 days, leaves 440 kg: 220 days for two.
    const { program: next, summary } = simulation.runTurn(program, sendLong);
    expect(simulation.readProgram(next).crew[0]?.suppliesDaysLeft).toBe(220);
    expect(summary.suppliesRanOut).toEqual([]);
  });

  it("go faster for a larger Crew", () => {
    const { simulation, program } = usingSupplies(0.5);
    const daysLeft = (size: number) =>
      simulation.readProgram(
        simulation.runTurn(program, withSupplies("test-supplies-long", size))
          .program,
      ).crew[0]?.suppliesDaysLeft;
    // 2,000 kg less 780 days at 1 kg a day for two, and at 1.5 kg a day for three.
    expect(daysLeft(2)).toBe(1220);
    expect(daysLeft(3)).toBe(553);
  });

  it("say in the events column and the Turn summary when they run out, even after a save and a load", () => {
    const { simulation, program } = usingSupplies(1);
    const saved = simulation.saveProgram(
      simulation.runTurn(program, sendLong).program,
    );
    const restored = simulation.restoreProgram(
      JSON.parse(JSON.stringify(saved)),
    );
    const { summary, timeline } = simulation.runTurn(restored, skipTurn);
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "suppliesOut")
        .map(({ day, title }) => [day, title]),
    ).toEqual([[220, "Supplies out in Mars orbit"]]);
    expect(summary.suppliesRanOut).toEqual([
      { crew: "Crew in Mars orbit", on: "2031-08-28" },
    ]);
  });

  it("lower Health quickly once they run out, and lose those who die then to Supplies", () => {
    const { simulation, program } = usingSupplies(1);
    const {
      summary,
      timeline,
      program: after,
    } = simulation.runTurn(
      simulation.runTurn(program, sendLong).program,
      skipTurn,
    );
    // Out on day 220, then 1 Health a day from 100.
    expect(summary.healthLost).toEqual([
      { name: "Ann Able", lost: [{ cause: "noSupplies", health: 100 }] },
      { name: "Ben Baker", lost: [{ cause: "noSupplies", health: 100 }] },
    ]);
    expect(summary.crewLost).toMatchObject([
      {
        names: ["Ann Able", "Ben Baker"],
        cause: "supplies",
        description:
          "Ann Able and Ben Baker were lost in Mars orbit, with no Supplies left.",
      },
    ]);
    expect(timeline.entries.find(({ kind }) => kind === "crewLost")?.day).toBe(
      320,
    );
    expect(simulation.readProgram(after).crew).toEqual([]);
  });

  it("can run out on the way, losing the Crew before they arrive", () => {
    const { simulation, program } = usingSupplies(10);
    // 1,000 kg at 20 kg a day lasts 50 days of the 200-day flight, and 100 Health lasts 100 more.
    const { summary, timeline } = simulation.runTurn(
      program,
      withSupplies("test-supplies-short"),
    );
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "suppliesOut" || kind === "crewLost")
        .map(({ day, title }) => [day, title]),
    ).toEqual([
      [50, "Supplies out aboard the Test Crew Ship"],
      [150, "Crew lost"],
    ]);
    expect(summary.crewLost).toMatchObject([
      {
        cause: "supplies",
        description:
          "Ann Able and Ben Baker were lost on the way to Mars, with no Supplies left.",
      },
    ]);
    expect(summary.suppliesRanOut).toEqual([
      { crew: "Crew aboard the Test Crew Ship", on: "2029-01-20" },
    ]);
    expect(summary.crew).toEqual([]);
  });

  it("are pooled with those of Crew already in the same place, who all share them", () => {
    // Crew who live on without Supplies, to follow them after they run out.
    const { simulation, program } = withFailures([], {
      startingMoneyMillions: 5000,
      crewHealth: steadyHealth,
      suppliesPerMemberPerDayKg: 1,
    });
    const first = simulation.runTurn(program, sendLong).program;
    // The first Crew have 440 kg, and use 400 kg before the second arrive on day 200 with 600 kg of their 1,000 kg.
    // 640 kg then lasts four Crew 160 days.
    const { timeline, program: after } = simulation.runTurn(
      first,
      withSupplies("test-supplies-short"),
    );
    expect(
      timeline.entries
        .filter(({ kind }) => kind === "suppliesOut")
        .map(({ day }) => day),
    ).toEqual([360]);
    const [inOrbit] = simulation.readProgram(after).crew;
    expect(inOrbit?.members).toHaveLength(4);
    expect(inOrbit?.suppliesDaysLeft).toBe(0);
    // Crew who start a Turn with none left are told so again.
    expect(
      simulation
        .runTurn(after, skipTurn)
        .timeline.entries.filter(({ kind }) => kind === "suppliesOut")
        .map(({ day, title }) => [day, title]),
    ).toEqual([[0, "No Supplies in Mars orbit"]]);
  });
});

describe("saving Supplies", () => {
  it("upgrades a save from before Supplies with the most on offer for the Crew in each place", () => {
    const { simulation } = setup();
    // A literal copy of what format 10 looks like. Don't change this: it's a compatibility contract.
    const formatTen = {
      formatVersion: 10,
      program: {
        seed: 1,
        turnNumber: 4,
        date: "2034-10-26",
        moneyMillions: 3000,
        publicSupport: 300,
        science: 400,
        milestoneIds: ["first-crew-at-mars", "first-crew-landing"],
        landedSiteIds: ["alpha-plain"],
        knownLandingSiteIds: ["alpha-plain", "beta-crater"],
        surveyedLandingSiteIds: [],
        fundingThresholdsPaid: [300],
        provenTechnologyIds: [],
        developments: [],
        operatingAssets: [],
        crew: [
          {
            name: "Ann Able",
            health: 60,
            arrivedOn: "2031-06-19",
            location: { kind: "marsOrbit" },
          },
          {
            name: "Ben Baker",
            health: 0,
            arrivedOn: "2031-06-19",
            location: { kind: "lost", lostOn: "2032-01-01", cause: "health" },
          },
          {
            name: "Cal Cole",
            health: 90,
            arrivedOn: "2033-06-19",
            location: { kind: "landingSite", landingSiteId: "alpha-plain" },
          },
          {
            name: "Dee Dunn",
            health: 90,
            arrivedOn: "2033-06-19",
            location: { kind: "landingSite", landingSiteId: "alpha-plain" },
          },
        ],
        crewActivities: {
          "mars-orbit": "test-research",
          "landing-site:alpha-plain": "test-traverse",
        },
        status: { kind: "active" },
      },
    };
    const restored = simulation.restoreProgram(formatTen);
    // Later formats give them no Protection.
    expect(restored.crew).toEqual(
      formatTen.program.crew.map((member) => ({
        ...member,
        protectionId: "test-protection-none",
      })),
    );
    // The Long Supplies' 2,000 kg, at a quarter of a kilogram a day each.
    expect(
      simulation
        .readProgram(restored)
        .crew.map(({ locationName, suppliesDaysLeft }) => [
          locationName,
          suppliesDaysLeft,
        ]),
    ).toEqual([
      ["Mars orbit", 8000],
      ["Alpha Plain", 4000],
    ]);
  });
});
