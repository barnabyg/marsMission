import type { CatalogueFiles } from "../catalogue/catalogue";

/** The test catalogue's Activities, with the kinds of research they do, for the tests of Activities, Ongoing Research and Research Grants. */
export function testActivities(): Pick<
  CatalogueFiles,
  "activities" | "researchKinds"
> {
  return {
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
          surfaceMotion: "nearby",
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
          surfaceMotion: "nearby",
        },
      },
      {
        id: "test-soil",
        name: "Test soil",
        description: "Earns less Science, and a Research Grant.",
        effect: {
          kind: "research",
          sciencePerTurn: 78,
          publicSupportPerTurn: 0,
          researchKind: "test-paid",
          surfaceMotion: "nearby",
        },
      },
      {
        id: "test-traverse",
        name: "Test traverse",
        description: "Earns more Science, and no Research Grant.",
        effect: {
          kind: "research",
          sciencePerTurn: 156,
          publicSupportPerTurn: 0,
          researchKind: "test-unpaid",
          surfaceMotion: "traverse",
        },
      },
      {
        id: "test-caching",
        name: "Test caching",
        description: "Collects samples at the Landing Site.",
        // One sample every 39 days over the 780-day Turn.
        effect: {
          kind: "sampleCaching",
          samplesPerTurn: 20,
          surfaceMotion: "nearby",
        },
      },
    ],
    researchKinds: [
      { id: "test-unpaid", name: "Unpaid", grantMillionsPerScience: 0 },
      { id: "test-paid", name: "Paid", grantMillionsPerScience: 0.5 },
    ],
  };
}
