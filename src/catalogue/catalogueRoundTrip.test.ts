import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with these changes to its round trip. */
function withRoundTrip(
  changes: Partial<CatalogueFiles["crew"]["roundTrip"]>,
): unknown {
  const files = testCatalogueFiles();
  return {
    ...files,
    crew: { ...files.crew, roundTrip: { ...files.crew.roundTrip, ...changes } },
  };
}

describe("round trips in the real data files", () => {
  const { crew, launchVehicles, missionEvents, contingencies, milestones } =
    parseCatalogue(realCatalogueFiles());
  const colossus =
    launchVehicles.find(({ id }) => id === "meridian-colossus")
      ?.capacityTonnes ?? 0;

  it("lets the smallest Crew with the least Supplies make a round trip on the Meridian Colossus", () => {
    const smallest = crew.sizes[0]?.massTonnes ?? Infinity;
    const leastSupplies = crew.supplies.options[0]?.massTonnes ?? Infinity;
    expect(
      smallest + leastSupplies + crew.roundTrip.massTonnes,
    ).toBeLessThanOrEqual(colossus);
  });

  it("brings the Crew home through trans-Earth injection and Earth entry, each with a Contingency", () => {
    expect(crew.roundTrip.missionEvents).toEqual([
      "trans-earth-injection",
      "earth-entry",
    ]);
    for (const eventId of crew.roundTrip.missionEvents) {
      expect(missionEvents.find(({ id }) => id === eventId)?.timing.from).toBe(
        "leavingMars",
      );
      expect(
        contingencies.some(({ missionEvent }) => missionEvent === eventId),
      ).toBe(true);
    }
  });

  it("makes the first Crew home a Milestone worth more Public Support than one Crew member's safe return", () => {
    const firstHome = milestones.find(
      ({ trigger }) => "crewComesHome" in trigger,
    );
    expect(firstHome?.publicSupport).toBeGreaterThan(
      crew.publicSupportPerMemberHome,
    );
  });
});

describe("validating the round trip", () => {
  it("accepts the Test Catalogue's round trip", () => {
    expect(() => parseCatalogue(testCatalogueFiles())).not.toThrow();
  });

  it("rejects a Mission Event that isn't in the data files", () => {
    expect(
      errorFrom(withRoundTrip({ missionEvents: ["test-nowhere"] })),
    ).toContain(
      'crew.json: the round trip refers to the Mission Event "test-nowhere", which isn\'t in mission-events.json',
    );
  });

  it("rejects a Mission Event on the way home that isn't timed from leaving Mars", () => {
    expect(
      errorFrom(withRoundTrip({ missionEvents: ["test-arrival"] })),
    ).toContain(
      'crew.json: the round trip brings the Mission Event "test-arrival" on the way home, but it isn\'t timed from leaving Mars',
    );
  });

  it("rejects a journey home that would end after its Turn", () => {
    expect(errorFrom(withRoundTrip({ leavesMarsOnDay: 600 }))).toContain(
      "crew.json: the journey home ends on day 800 of the Turn, which must be before the Turn ends on day 780",
    );
  });

  it("rejects a round trip with no mass", () => {
    expect(errorFrom(withRoundTrip({ massTonnes: 0 }))).toContain("crew.json");
  });

  it("rejects a Milestone for Crew coming home that names anything else", () => {
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
            trigger: { crewComesHome: "yes" },
            science: 0,
            publicSupport: 0,
          },
        ],
      }),
    ).toContain("crewComesHome with true");
  });
});
