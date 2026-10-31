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
      assets: files.assets.map((asset) => ({ ...asset, surveys: true })),
    });
    expect(message).toContain("can't both land and survey");
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
