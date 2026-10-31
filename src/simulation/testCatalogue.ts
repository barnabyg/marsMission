import {
  parseCatalogue,
  type Catalogue,
  type CatalogueFiles,
} from "../catalogue/catalogue";

/** Long enough that an Asset outlasts the rule tests that aren't about Service Life. */
const longLife = [
  { days: 50_000, costMillions: 0 },
  { days: 90_000, costMillions: 100 },
];

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
    activities: [
      {
        id: "test-survey",
        name: "Survey",
        description: "Looks for sites.",
        effect: { kind: "survey" },
      },
      {
        id: "test-nothing",
        name: "Nothing",
        description: "Does no work.",
        effect: { kind: "nothing" },
      },
      {
        id: "test-research",
        name: "Test research",
        description: "Earns Science and Public Support.",
        // A tenth of a Science and a twentieth of a Public Support point a day, over the 780-day Turn.
        effect: {
          kind: "research",
          sciencePerTurn: 78,
          publicSupportPerTurn: 39,
          researchKind: "test-unpaid",
        },
      },
      {
        id: "test-paid-research",
        name: "Paid research",
        description: "Earns Science that pays a Research Grant.",
        // No Asset lists it. The tests of Research Grants give it to the Assets.
        effect: {
          kind: "research",
          sciencePerTurn: 78,
          publicSupportPerTurn: 0,
          researchKind: "test-paid",
        },
      },
    ],
    researchKinds: [
      { id: "test-unpaid", name: "Unpaid", grantMillionsPerScience: 0 },
      { id: "test-paid", name: "Paid", grantMillionsPerScience: 0.5 },
    ],
    launchVehicles: [
      {
        id: "test-vehicle",
        name: "Test Vehicle",
        costMillions: 100,
        capacityTonnes: 5,
        missionEvents: ["test-launch", "test-burn"],
      },
      {
        id: "test-heavy",
        name: "Test Heavy",
        costMillions: 300,
        capacityTonnes: 10,
        missionEvents: ["test-launch", "test-burn"],
      },
    ],
    assets: [
      {
        id: "test-orbiter",
        name: "Test Orbiter",
        kind: "orbiter",
        costMillions: 400,
        massTonnes: 2,
        failureChancePerTurn: 0,
        serviceLifeOptions: longLife,
        missionEvents: ["test-arrival"],
        activities: ["test-survey", "test-nothing", "test-research"],
      },
      {
        id: "gold-orbiter",
        name: "Gold Orbiter",
        kind: "orbiter",
        costMillions: 5000,
        massTonnes: 1,
        failureChancePerTurn: 0,
        serviceLifeOptions: longLife,
        missionEvents: ["test-arrival"],
        activities: ["test-survey", "test-nothing"],
      },
      {
        id: "test-relay",
        name: "Test Relay",
        kind: "relay",
        costMillions: 100,
        massTonnes: 2,
        failureChancePerTurn: 0,
        serviceLifeOptions: longLife,
        missionEvents: ["test-arrival"],
        activities: ["test-nothing"],
      },
      {
        id: "test-lander",
        name: "Test Lander",
        kind: "lander",
        costMillions: 300,
        massTonnes: 3,
        failureChancePerTurn: 0,
        serviceLifeOptions: longLife,
        missionEvents: ["test-landing"],
        activities: ["test-nothing", "test-research"],
        landsAtSite: true,
      },
    ],
    landingSites: [
      {
        id: "alpha-plain",
        name: "Alpha Plain",
        description: "Flat.",
        landingRisk: 0.8,
        surveyedLandingRisk: 0,
        science: 50,
        knownFromStart: true,
        latitude: 10,
        longitude: 20,
      },
      {
        id: "beta-crater",
        name: "Beta Crater",
        description: "Deep.",
        landingRisk: 0.8,
        surveyedLandingRisk: 0,
        science: 80,
        knownFromStart: true,
        latitude: -10,
        longitude: -20,
      },
      {
        id: "gamma-basin",
        name: "Gamma Basin",
        description: "Hidden.",
        landingRisk: 0,
        surveyedLandingRisk: 0,
        science: 200,
        knownFromStart: false,
        latitude: 30,
        longitude: 40,
      },
      {
        id: "delta-rift",
        name: "Delta Rift",
        description: "Hidden too.",
        landingRisk: 0,
        surveyedLandingRisk: 0,
        science: 300,
        knownFromStart: false,
        latitude: -30,
        longitude: -40,
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
      {
        id: "first-landing",
        name: "First landing",
        description: "A lander reached the surface.",
        trigger: { assetKindArrives: "lander" },
        science: 40,
        publicSupport: 60,
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
      {
        id: "test-landing",
        name: "Test landing",
        description: "Touched down at {site}.",
        failureDescription: "It crashed at {site}.",
        timing: { from: "arrival", days: 5 },
        failureProbability: "landingSite",
        publicSupportLoss: 50,
      },
    ],
  };
}

export function testCatalogue(): Catalogue {
  return parseCatalogue(testCatalogueFiles());
}
