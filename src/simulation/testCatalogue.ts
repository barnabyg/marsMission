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
    ],
    missionEvents: [
      {
        id: "test-launch",
        name: "Test launch",
        description: "Lifts off.",
        timing: { from: "launch", days: 0 },
      },
      {
        id: "test-burn",
        name: "Test burn",
        description: "Burns.",
        timing: { from: "launch", days: 1 },
      },
      {
        id: "test-arrival",
        name: "Test arrival",
        description: "Arrives.",
        timing: { from: "arrival", days: 0 },
      },
    ],
  };
}

export function testCatalogue(): Catalogue {
  return parseCatalogue(testCatalogueFiles());
}
