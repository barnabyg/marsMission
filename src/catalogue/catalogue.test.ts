import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogueFileNames,
  CatalogueError,
  parseCatalogue,
  type CatalogueFiles,
} from "./catalogue";
import { createSimulation } from "../simulation/simulation";
import { testCatalogueFiles } from "../simulation/testCatalogue";

function realFiles(): CatalogueFiles {
  const read = (fileName: string): unknown =>
    JSON.parse(readFileSync(`public/data/${fileName}`, "utf8"));
  const files = Object.fromEntries(
    Object.entries(catalogueFileNames).map(([key, fileName]) => [
      key,
      read(fileName),
    ]),
  );
  return files as unknown as CatalogueFiles;
}

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
    expect(() => parseCatalogue(realFiles())).not.toThrow();
  });

  it("start the Program at the late-2028 Launch Window with about $2B", () => {
    const { program } = parseCatalogue(realFiles());
    expect(program.firstLaunchWindow).toMatch(/^2028-(1[0-2])/);
    expect(program.startingMoneyMillions).toBe(2000);
  });

  it("drain 15% per Turn with a Cancellation Level of 50", () => {
    const { program } = parseCatalogue(realFiles());
    expect(program.publicSupportDrainPercent).toBe(15);
    expect(program.cancellationLevel).toBe(50);
  });

  it("cancel a Program that only skips Turns", () => {
    const simulation = createSimulation(parseCatalogue(realFiles()));
    let program = simulation.startProgram(1);
    for (let turn = 0; turn < 100; turn++) {
      if (simulation.readProgram(program).status.kind !== "active") break;
      program = simulation.runTurn(program, { mission: null }).program;
    }
    expect(simulation.readProgram(program).status.kind).toBe("cancelled");
  });

  it("offer one Launch Vehicle and one orbiter", () => {
    const catalogue = parseCatalogue(realFiles());
    expect(catalogue.launchVehicles).toHaveLength(1);
    expect(catalogue.assets.map((asset) => asset.kind)).toEqual(["orbiter"]);
  });
});

describe("the real Milestones", () => {
  it("award the first orbiter 200 Public Support", () => {
    const { milestones } = parseCatalogue(realFiles());
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.publicSupport).toBe(200);
  });
});

describe("the real Funding Thresholds", () => {
  it("can be reached by the one Milestone in this phase", () => {
    const { fundingThresholds, milestones, program } =
      parseCatalogue(realFiles());
    const reachable =
      program.startingPublicSupport + (milestones[0]?.publicSupport ?? 0);
    expect(fundingThresholds[0]).toEqual({
      publicSupport: 300,
      payoutMillions: 1000,
    });
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
