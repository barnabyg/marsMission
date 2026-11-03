import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with these changes to its Crewed Mission. */
function withCrew(changes: Partial<CatalogueFiles["crew"]>): unknown {
  const files = testCatalogueFiles();
  return { ...files, crew: { ...files.crew, ...changes } };
}

describe("Crew in the real data files", () => {
  const { crew, launchVehicles, assets } = parseCatalogue(realCatalogueFiles());
  const capacityOf = (id: string) =>
    launchVehicles.find((vehicle) => vehicle.id === id)?.capacityTonnes ?? 0;

  it("makes even the smallest Crewed Mission too heavy for the Meridian Heavy, and the largest fit the Meridian Colossus", () => {
    const masses = crew.sizes.map(({ massTonnes }) => massTonnes);
    expect(Math.min(...masses)).toBeGreaterThan(capacityOf("meridian-heavy"));
    expect(Math.max(...masses)).toBeLessThan(capacityOf("meridian-colossus"));
  });

  it("makes a larger Crew weigh and cost more", () => {
    for (const [index, size] of crew.sizes.entries()) {
      const smaller = crew.sizes[index - 1];
      if (!smaller) continue;
      expect(size.massTonnes).toBeGreaterThan(smaller.massTonnes);
      expect(size.costMillions).toBeGreaterThan(smaller.costMillions);
    }
  });

  it("makes even the smallest Crewed Mission cost much more than any Asset", () => {
    const cheapest = Math.min(
      ...crew.sizes.map(({ costMillions }) => costMillions),
    );
    const dearestAsset = Math.max(
      ...assets.map(
        (asset) => asset.unproven?.costMillions ?? asset.costMillions,
      ),
    );
    expect(cheapest).toBeGreaterThan(2 * dearestAsset);
  });

  it("makes losing even one Crew member cost more Public Support than any failed Mission Event", () => {
    const { missionEvents } = parseCatalogue(realCatalogueFiles());
    expect(crew.publicSupportLossPerMember).toBeGreaterThan(
      Math.max(
        ...missionEvents.map(({ publicSupportLoss }) => publicSupportLoss),
      ),
    );
  });

  it("makes a Slow Trajectory cost more Health on the way than a Fast one, but leave Crew most of it", () => {
    const { trajectories } = parseCatalogue(realCatalogueFiles());
    const lostOnTheWay = (id: string) =>
      crew.health.radiationPerDay.inFlight *
      (trajectories.find((trajectory) => trajectory.id === id)?.transferDays ??
        0);
    expect(lostOnTheWay("slow")).toBeGreaterThan(lostOnTheWay("fast"));
    expect(
      lostOnTheWay("slow") + crew.health.contingencyRescueLoss,
    ).toBeLessThan(crew.maxHealth / 2);
  });

  it("makes Crew at Mars die there in the end, though not in their first Turn", () => {
    const { program } = parseCatalogue(realCatalogueFiles());
    const perTurn =
      (crew.health.radiationPerDay.atMars + crew.health.timeAtMarsPerDay) *
      program.launchWindowIntervalDays;
    expect(perTurn).toBeGreaterThan(0);
    expect(perTurn).toBeLessThan(crew.maxHealth / 2);
  });

  it("names enough Crew for several Crewed Missions of the largest size", () => {
    const largest = Math.max(...crew.sizes.map((size) => size.crew));
    expect(crew.names.length).toBeGreaterThanOrEqual(4 * largest);
  });
});

describe("invalid Crew", () => {
  it("accepts the Test Catalogue's Crewed Mission", () => {
    expect(parseCatalogue(testCatalogueFiles()).crew.sizes).toHaveLength(2);
  });

  it("rejects Crew sizes out of order", () => {
    const { sizes } = testCatalogueFiles().crew;
    expect(errorFrom(withCrew({ sizes: sizes.toReversed() }))).toContain(
      "crew.json: a Crew size of 2 comes after one of 3. Sizes go in ascending order",
    );
  });

  it("rejects a Crew size of no one", () => {
    expect(
      errorFrom(
        withCrew({ sizes: [{ crew: 0, costMillions: 100, massTonnes: 1 }] }),
      ),
    ).toContain("crew.json: sizes.0.crew:");
  });

  it("rejects losing Crew gaining Public Support", () => {
    expect(errorFrom(withCrew({ publicSupportLossPerMember: -1 }))).toContain(
      "crew.json: publicSupportLossPerMember:",
    );
  });

  it("rejects Health that rises over time", () => {
    const { health } = testCatalogueFiles().crew;
    expect(
      errorFrom(withCrew({ health: { ...health, timeAtMarsPerDay: -0.1 } })),
    ).toContain("crew.json: health.timeAtMarsPerDay:");
    expect(
      errorFrom(
        withCrew({
          health: {
            ...health,
            radiationPerDay: { ...health.radiationPerDay, inFlight: -0.1 },
          },
        }),
      ),
    ).toContain("crew.json: health.radiationPerDay.inFlight:");
  });

  it("rejects a Contingency rescue that costs all of a Crew member's Health", () => {
    const { health } = testCatalogueFiles().crew;
    expect(
      errorFrom(
        withCrew({ health: { ...health, contingencyRescueLoss: 100 } }),
      ),
    ).toContain(
      "crew.json: a Contingency rescue costs 100 Health, which must be less than the 100 Crew start with",
    );
  });

  it("rejects a Mission Event that isn't in the data files", () => {
    expect(errorFrom(withCrew({ missionEvents: ["warp-drive"] }))).toContain(
      `crew.json: the Crewed Mission refers to the Mission Event "warp-drive", which isn't in mission-events.json`,
    );
  });

  it("rejects a Mission Event that needs a Landing Site, because Crew stay in Mars orbit", () => {
    expect(errorFrom(withCrew({ missionEvents: ["test-landing"] }))).toContain(
      `crew.json: the Crewed Mission can't use the Mission Event "test-landing", which needs a Landing Site`,
    );
  });

  it("rejects an Activity that isn't in the data files", () => {
    expect(
      errorFrom(withCrew({ orbitActivities: ["test-nothing", "juggling"] })),
    ).toContain(
      `crew.json: Crew refer to the Activity "juggling", which isn't in activities.json`,
    );
  });

  it("rejects a Survey as an Activity for Crew", () => {
    expect(errorFrom(withCrew({ orbitActivities: ["test-survey"] }))).toContain(
      `crew.json: Crew can't do the Activity "test-survey", because a Survey is for an Asset`,
    );
  });

  it("rejects a name given twice", () => {
    expect(
      errorFrom(withCrew({ names: ["Ann Able", "Ben Baker", "Ann Able"] })),
    ).toContain(`crew.json: the name "Ann Able" is listed more than once`);
  });

  it("rejects too few names for the largest Crew", () => {
    expect(errorFrom(withCrew({ names: ["Ann Able", "Ben Baker"] }))).toContain(
      "crew.json: there must be at least as many names as the largest Crew size, 3",
    );
  });

  it("rejects a Milestone for Crew arriving that names anything else", () => {
    const files = testCatalogueFiles();
    expect(
      errorFrom({
        ...files,
        milestones: [
          ...files.milestones,
          {
            id: "odd",
            name: "Odd",
            description: "Odd.",
            trigger: { crewArrives: false },
            science: 1,
            publicSupport: 1,
          },
        ],
      }),
    ).toContain("milestones.json: 5.trigger:");
  });
});
