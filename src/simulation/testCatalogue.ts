import {
  parseCatalogue,
  type Catalogue,
  type CatalogueFiles,
} from "../catalogue/catalogue";

/** A small catalogue with round numbers, so balance changes to the real data files don't break rule tests. */
export function testCatalogueFiles(): CatalogueFiles {
  return {
    program: {
      firstLaunchWindow: "2028-12-01",
      launchWindowIntervalDays: 780,
      startingMoneyMillions: 2000,
      startingPublicSupport: 100,
      transferDays: 200,
      publicSupportDrainPercent: 15,
      cancellationLevel: 50,
    },
    launchVehicles: [
      {
        id: "test-vehicle",
        name: "Test Vehicle",
        costMillions: 100,
        missionEvents: ["test-launch", "test-burn"],
      },
    ],
    assets: [
      {
        id: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        costMillions: 400,
        missionEvents: ["test-arrival"],
      },
      {
        id: "gold-orbiter",
        name: "Gold Orbiter",
        kind: "orbiter",
        costMillions: 5000,
        missionEvents: ["test-arrival"],
      },
      {
        id: "test-relay",
        name: "Test Relay",
        kind: "relay",
        costMillions: 100,
        missionEvents: ["test-arrival"],
      },
    ],
    fundingThresholds: [
      { publicSupport: 300, payoutMillions: 1000 },
      { publicSupport: 1000, payoutMillions: 7000 },
    ],
    milestones: [
      {
        id: "first-orbiter",
        name: "First orbiter",
        description: "An orbiter reached Mars.",
        trigger: { assetKindArrives: "orbiter" },
        science: 100,
        publicSupport: 200,
      },
      {
        id: "first-relay",
        name: "First relay",
        description: "A relay reached Mars.",
        trigger: { assetKindArrives: "relay" },
        science: 10,
        publicSupport: 100,
      },
    ],
    reliabilityLevels: [
      { id: "none", name: "None", costMillions: 0, failureMultiplier: 1 },
      {
        id: "tested",
        name: "Tested",
        costMillions: 50,
        failureMultiplier: 0.5,
      },
      {
        id: "redundant",
        name: "Redundant",
        costMillions: 200,
        failureMultiplier: 0.1,
      },
    ],
    riskBands: [
      { upTo: 0.01, label: "~1%" },
      { upTo: 0.05, label: "~5%" },
      { upTo: 0.1, label: "~10%" },
      { upTo: 1, label: "Over 10%" },
    ],
    missionEvents: [
      {
        id: "test-launch",
        name: "Test launch",
        description: "Lifts off.",
        failureDescription: "It blew up on the pad.",
        timing: { from: "launch", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 20,
      },
      {
        id: "test-burn",
        name: "Test burn",
        description: "Burns.",
        failureDescription: "The engine cut out.",
        timing: { from: "launch", days: 1 },
        failureProbability: 0,
        publicSupportLoss: 30,
      },
      {
        id: "test-arrival",
        name: "Test arrival",
        description: "Arrives.",
        failureDescription: "It flew straight past.",
        timing: { from: "arrival", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 40,
      },
    ],
  };
}

export function testCatalogue(): Catalogue {
  return parseCatalogue(testCatalogueFiles());
}
