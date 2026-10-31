import { describe, expect, it } from "vitest";
import {
  CatalogueError,
  parseCatalogue,
  type CatalogueFiles,
} from "./catalogue";
import { createSimulation } from "../simulation/simulation";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

function errorFrom(files: unknown): string {
  try {
    parseCatalogue(files as CatalogueFiles);
  } catch (error) {
    if (error instanceof CatalogueError) return error.message;
    throw error;
  }
  throw new Error("Expected the catalogue to be rejected");
}

describe("the real data files", () => {
  it("are valid", () => {
    expect(() => parseCatalogue(realCatalogueFiles())).not.toThrow();
  });

  it.each([
    ["orbiter", ["survey", "research", "nothing"]],
    ["lander", ["research", "nothing"]],
    ["rover", ["research", "research", "nothing"]],
  ])("give a %s these choices, starting on the first", (kind, expected) => {
    const { assets, activities } = parseCatalogue(realCatalogueFiles());
    const effects = assets
      .find((asset) => asset.kind === kind)
      ?.activities.map(
        (activityId) =>
          activities.find(({ id }) => id === activityId)?.effect.kind,
      );
    expect(effects).toEqual(expected);
  });

  it("have a second Launch Vehicle with more capacity at a higher cost", () => {
    const [first, second] = realCatalogueFiles().launchVehicles;
    expect(second?.capacityTonnes).toBeGreaterThan(first?.capacityTonnes ?? 0);
    expect(second?.costMillions).toBeGreaterThan(first?.costMillions ?? 0);
  });

  it("cancel a Program that only skips Turns", () => {
    const simulation = createSimulation(parseCatalogue(realCatalogueFiles()));
    let program = simulation.startProgram(1);
    for (let turn = 0; turn < 100; turn++) {
      if (simulation.readProgram(program).status.kind !== "active") break;
      program = simulation.runTurn(program, { mission: null }).program;
    }
    expect(simulation.readProgram(program).status.kind).toBe("cancelled");
  });

  it("can reach the first Funding Threshold with the available Milestones", () => {
    const { fundingThresholds, milestones, program } =
      parseCatalogue(realCatalogueFiles());
    const reachable = milestones.reduce(
      (total, { publicSupport }) => total + publicSupport,
      program.startingPublicSupport,
    );
    expect(fundingThresholds[0]?.publicSupport).toBeLessThanOrEqual(reachable);
  });
});

describe("invalid data files", () => {
  it("name the file and field when a number is mistyped", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: [{ ...files.assets[0], costMillions: "400" }],
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("costMillions");
  });

  it("name the file when a field is missing", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      program: { ...files.program, startingMoneyMillions: undefined },
    });
    expect(message).toContain("program.json");
    expect(message).toContain("startingMoneyMillions");
  });

  it("reject a Mission Event reference that doesn't exist", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: [{ ...files.assets[0], missionEvents: ["no-such-event"] }],
    });
    expect(message).toContain("no-such-event");
  });

  it("reject duplicate ids", () => {
    const files = testCatalogueFiles();
    const asset = files.assets[0];
    const message = errorFrom({ ...files, assets: [asset, asset] });
    expect(message).toContain("test-orbiter");
  });

  it("reject a Milestone for a kind of Asset that doesn't exist", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      milestones: [
        {
          ...files.milestones[0],
          trigger: { assetKindArrives: "submarine" },
        },
      ],
    });
    expect(message).toContain("milestones.json");
    expect(message).toContain("submarine");
  });

  it("reject a Milestone for landing when no Asset lands", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.filter(({ landsAtSite }) => !landsAtSite),
      milestones: [{ ...files.milestones[0], trigger: { assetLands: true } }],
    });
    expect(message).toContain("milestones.json");
    expect(message).toContain("landsAtSite");
  });

  it.each([
    ["zero", { totalScience: 0 }],
    ["negative", { totalScience: -5 }],
    ["not a whole number", { totalScience: 1.5 }],
    ["not a number", { totalScience: "100" }],
    ["alongside another trigger", { totalScience: 100, assetLands: true }],
  ])("reject a Milestone for total Science that is %s", (_, trigger) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      milestones: [{ ...files.milestones[0], trigger }],
    });
    expect(message).toContain("milestones.json");
    expect(message).toContain("0.trigger");
    expect(message).toContain("totalScience");
  });

  it.each([
    ["no way of moving", undefined],
    ["an unknown way of moving", "hopping"],
  ])("reject a research Activity with %s", (_, surfaceMotion) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "bad-research",
          name: "Bad research",
          description: "Doesn't say how it moves.",
          effect: {
            kind: "research",
            sciencePerTurn: 10,
            publicSupportPerTurn: 1,
            researchKind: "test-unpaid",
            surfaceMotion,
          },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain("surfaceMotion");
  });

  it("reject a Cancellation Level that could never be fallen below", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      program: { ...files.program, cancellationLevel: 0 },
    });
    expect(message).toContain("cancellationLevel");
  });

  it("reject a drain that wouldn't reduce Public Support", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      program: { ...files.program, publicSupportDrainPercent: 0 },
    });
    expect(message).toContain("publicSupportDrainPercent");
  });

  it("reject a Funding Threshold the Program starts at or above", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      fundingThresholds: [{ publicSupport: 100, payoutMillions: 1000 }],
    });
    expect(message).toContain("funding-thresholds.json");
  });

  it("reject Funding Thresholds that aren't in ascending order", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      fundingThresholds: [
        { publicSupport: 500, payoutMillions: 1000 },
        { publicSupport: 300, payoutMillions: 1000 },
      ],
    });
    expect(message).toContain("funding-thresholds.json");
  });

  it.each([
    ["failureProbability", -0.1],
    ["failureProbability", 1.5],
    ["failureProbability", "often"],
    ["failureProbability", undefined],
    ["publicSupportLoss", -5],
    ["publicSupportLoss", 2.5],
    ["publicSupportLoss", undefined],
    ["failureDescription", ""],
  ])("reject a Mission Event whose %s is %s", (field, value) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      missionEvents: [{ ...files.missionEvents[0], [field]: value }],
    });
    expect(message).toContain("mission-events.json");
    expect(message).toContain(field);
  });

  it.each([
    [
      "aren't in ascending order",
      [
        { upTo: 0.5, label: "A" },
        { upTo: 0.1, label: "B" },
        { upTo: 1, label: "C" },
      ],
    ],
    ["leave high probabilities uncovered", [{ upTo: 0.5, label: "A" }]],
    ["are empty", []],
    ["go above a probability of 1", [{ upTo: 1.5, label: "A" }]],
    ["have no label", [{ upTo: 1, label: "" }]],
  ])("reject risk bands that %s", (_, riskBands) => {
    const message = errorFrom({ ...testCatalogueFiles(), riskBands });
    expect(message).toContain("risk-bands.json");
  });

  it.each([
    [
      "a higher level costs less",
      [
        { id: "a", name: "A", costMillions: 100, failureMultiplier: 1 },
        { id: "b", name: "B", costMillions: 50, failureMultiplier: 0.5 },
      ],
    ],
    [
      "a higher level has a higher failure probability",
      [
        { id: "a", name: "A", costMillions: 0, failureMultiplier: 0.5 },
        { id: "b", name: "B", costMillions: 50, failureMultiplier: 0.8 },
      ],
    ],
    [
      "a level raises the failure probability above the Mission Event's own",
      [{ id: "a", name: "A", costMillions: 0, failureMultiplier: 1.5 }],
    ],
    [
      "a level has a negative failure probability",
      [{ id: "a", name: "A", costMillions: 0, failureMultiplier: -0.5 }],
    ],
    ["there are no levels", []],
    [
      "two levels share an id",
      [
        { id: "a", name: "A", costMillions: 0, failureMultiplier: 1 },
        { id: "a", name: "B", costMillions: 50, failureMultiplier: 0.5 },
      ],
    ],
  ])("reject Reliability levels when %s", (_, reliabilityLevels) => {
    const message = errorFrom({ ...testCatalogueFiles(), reliabilityLevels });
    expect(message).toContain("reliability-levels.json");
  });

  it("reject an Asset with no mass", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({ ...asset, massTonnes: 0 })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("massTonnes");
  });

  it("reject a Launch Vehicle with no capacity", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) => ({
        ...vehicle,
        capacityTonnes: -1,
      })),
    });
    expect(message).toContain("launch-vehicles.json");
    expect(message).toContain("capacityTonnes");
  });

  it("reject an Asset that both lands and surveys", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-survey", "test-nothing"],
      })),
    });
    expect(message).toContain("can't both land and survey");
  });

  it("reject an Asset with an Activity that isn't in the data files", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["juggling"],
      })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain('the Activity "juggling"');
    expect(message).toContain("activities.json");
  });

  it("reject an Asset with no Activities", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({ ...asset, activities: [] })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("activities");
  });

  it("reject an Asset that lists an Activity twice", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-nothing", "test-nothing"],
      })),
    });
    expect(message).toContain(
      'lists the Activity "test-nothing" more than once',
    );
  });

  it("reject an Activity whose id is used twice", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [...files.activities, ...files.activities],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain('"test-survey" is used more than once');
  });

  it("reject an Activity with an effect the game doesn't know", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "juggling",
          name: "Juggling",
          description: "Throws things.",
          effect: { kind: "juggling" },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain("effect");
  });

  it.each([
    ["a negative Science rate", { sciencePerTurn: -1 }, "sciencePerTurn"],
    ["a Science rate of zero", { sciencePerTurn: 0 }, "sciencePerTurn"],
    ["a fractional Science rate", { sciencePerTurn: 1.5 }, "sciencePerTurn"],
    ["a missing Science rate", { sciencePerTurn: undefined }, "sciencePerTurn"],
    [
      "a negative Public Support rate",
      { publicSupportPerTurn: -1 },
      "publicSupportPerTurn",
    ],
    [
      "a fractional Public Support rate",
      { publicSupportPerTurn: 0.5 },
      "publicSupportPerTurn",
    ],
  ])("reject a research Activity with %s", (_, rates, field) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "bad-research",
          name: "Bad research",
          description: "Earns the wrong amount.",
          effect: {
            kind: "research",
            sciencePerTurn: 10,
            publicSupportPerTurn: 1,
            researchKind: "test-unpaid",
            surfaceMotion: "nearby",
            ...rates,
          },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain(field);
  });

  it.each([
    ["a missing kind of research", undefined, "researchKind"],
    ["an unknown kind of research", "no-such-kind", '"no-such-kind"'],
  ])("reject a research Activity with %s", (_, researchKind, expected) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "bad-research",
          name: "Bad research",
          description: "Has the wrong kind.",
          effect: {
            kind: "research",
            sciencePerTurn: 10,
            publicSupportPerTurn: 1,
            researchKind,
            surfaceMotion: "nearby",
          },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain(expected);
  });

  it.each([
    ["negative", -0.5],
    ["missing", undefined],
    ["not a number", "1"],
  ])("reject a Research Grant rate that is %s", (_, rate) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      researchKinds: [
        { id: "bad-kind", name: "Bad", grantMillionsPerScience: rate },
      ],
    });
    expect(message).toContain("research-kinds.json");
    expect(message).toContain("grantMillionsPerScience");
  });

  it("reject two kinds of research with the same id", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      researchKinds: [...files.researchKinds, ...files.researchKinds],
    });
    expect(message).toContain("research-kinds.json");
    expect(message).toContain("more than once");
  });

  it("reject data files with no Activity that does nothing", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: files.activities.filter(
        ({ effect }) => effect.kind !== "nothing",
      ),
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-survey"],
        landsAtSite: false,
      })),
    });
    expect(message).toContain("activities.json");
    expect(message).toContain('"nothing" effect');
  });

  it("reject a Landing Site with an invalid risk", () => {
    const files = testCatalogueFiles();
    const [site] = files.landingSites;
    const message = errorFrom({
      ...files,
      landingSites: [{ ...site, landingRisk: 2 }],
    });
    expect(message).toContain("landing-sites.json");
    expect(message).toContain("landingRisk");
  });

  it("reject a Landing Site that isn't on the globe", () => {
    const files = testCatalogueFiles();
    const [site] = files.landingSites;
    const message = errorFrom({
      ...files,
      landingSites: [{ ...site, latitude: 100 }],
    });
    expect(message).toContain("latitude");
  });

  it("reject a surveyed landing risk higher than the landing risk", () => {
    const files = testCatalogueFiles();
    const [site] = files.landingSites;
    const message = errorFrom({
      ...files,
      landingSites: [{ ...site, landingRisk: 0.1, surveyedLandingRisk: 0.2 }],
    });
    expect(message).toContain("surveyedLandingRisk");
  });

  it("reject a lander when no Landing Site is known from the start", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      landingSites: files.landingSites.map((site) => ({
        ...site,
        knownFromStart: false,
      })),
    });
    expect(message).toContain("known from the start");
  });

  it("reject a Mission Event that needs a Landing Site on an Asset that doesn't land", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        landsAtSite: false,
      })),
    });
    expect(message).toContain("landsAtSite");
  });

  it("reject a Mission Event that needs a Landing Site on a Launch Vehicle", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      launchVehicles: files.launchVehicles.map((vehicle) => ({
        ...vehicle,
        missionEvents: [...vehicle.missionEvents, "test-landing"],
      })),
    });
    expect(message).toContain("launch-vehicles.json");
  });

  it("reject a date that isn't a real date", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      program: { ...files.program, firstLaunchWindow: "2028-13-45" },
    });
    expect(message).toContain("firstLaunchWindow");
  });

  it("reject a transfer that wouldn't finish within the Turn", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      program: { ...files.program, transferDays: 800 },
    });
    expect(message).toContain("transferDays");
  });
});
