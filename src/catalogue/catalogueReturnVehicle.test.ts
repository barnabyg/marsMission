import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

/** The Test Catalogue with these changes to its return vehicle. */
function withReturnVehicle(
  changes: Partial<CatalogueFiles["crew"]["returnVehicle"]>,
): unknown {
  const files = testCatalogueFiles();
  return {
    ...files,
    crew: {
      ...files.crew,
      returnVehicle: { ...files.crew.returnVehicle, ...changes },
    },
  };
}

describe("the return vehicle in the real data files", () => {
  const { crew, launchVehicles, contingencies } =
    parseCatalogue(realCatalogueFiles());
  const capacityOf = (vehicleId: string) =>
    launchVehicles.find(({ id }) => id === vehicleId)?.capacityTonnes ?? 0;

  it("has room for the largest Crew, so that it can fetch any one Crewed Mission's Crew", () => {
    const largest = Math.max(...crew.sizes.map((size) => size.crew));
    expect(crew.returnVehicle.crewRoom).toBeGreaterThanOrEqual(largest);
  });

  it("flies on its own on a Launch Vehicle that needs no Development", () => {
    expect(crew.returnVehicle.massTonnes).toBeLessThanOrEqual(
      capacityOf("meridian-heavy"),
    );
  });

  it("fits beside the smallest Crew with the least Supplies on the Meridian Colossus, so that Crew can be swapped", () => {
    const smallest = crew.sizes[0]?.massTonnes ?? Infinity;
    const leastSupplies = crew.supplies.options[0]?.massTonnes ?? Infinity;
    expect(
      smallest + leastSupplies + crew.returnVehicle.massTonnes,
    ).toBeLessThanOrEqual(capacityOf("meridian-colossus"));
  });

  it("costs more than the Earth return stage a round trip carries, so that planning ahead pays", () => {
    expect(crew.returnVehicle.costMillions).toBeGreaterThan(
      crew.roundTrip.costMillions,
    );
  });

  it("reaches Mars orbit through Mars orbit insertion, which has a Contingency", () => {
    expect(crew.returnVehicle.missionEvents).toEqual(["mars-orbit-insertion"]);
    expect(
      contingencies.some(
        ({ missionEvent }) => missionEvent === "mars-orbit-insertion",
      ),
    ).toBe(true);
  });
});

describe("validating the return vehicle", () => {
  it("accepts the Test Catalogue's return vehicle", () => {
    expect(
      parseCatalogue(testCatalogueFiles()).crew.returnVehicle,
    ).toMatchObject({ name: "Test return vehicle", crewRoom: 2 });
  });

  it("rejects one with no room for Crew", () => {
    expect(errorFrom(withReturnVehicle({ crewRoom: 0 }))).toContain("crewRoom");
  });

  it("rejects one without room for the smallest Crew", () => {
    expect(errorFrom(withReturnVehicle({ crewRoom: 1 }))).toContain(
      "crew.json: the return vehicle has room for 1 Crew member, fewer than the smallest Crew size, 2",
    );
  });

  it("rejects a Mission Event that isn't in the data files", () => {
    expect(
      errorFrom(withReturnVehicle({ missionEvents: ["test-nowhere"] })),
    ).toContain(
      'crew.json: the return vehicle refers to the Mission Event "test-nowhere", which isn\'t in mission-events.json',
    );
  });

  it("rejects a Mission Event timed from leaving Mars on the way there", () => {
    expect(
      errorFrom(withReturnVehicle({ missionEvents: ["test-ascent"] })),
    ).toContain(
      'crew.json: the return vehicle brings the Mission Event "test-ascent", which is timed from leaving Mars, on the way to Mars',
    );
  });

  it("rejects a Mission Event that needs a Landing Site, because it waits in Mars orbit", () => {
    expect(
      errorFrom(withReturnVehicle({ missionEvents: ["test-landing"] })),
    ).toContain(
      'crew.json: the return vehicle can\'t use the Mission Event "test-landing" to reach Mars orbit, because it needs a Landing Site',
    );
  });
});
