import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

describe("orbital refuelling in the real data files", () => {
  const { launchVehicles } = parseCatalogue(realCatalogueFiles());
  const refuelled = launchVehicles.filter(({ missionEvents }) =>
    missionEvents.includes("rendezvous"),
  );

  it("has one Launch Vehicle that needs it, bringing a tanker launch and a rendezvous between launch and the Mars transfer burn", () => {
    expect(refuelled.map(({ missionEvents }) => missionEvents)).toEqual([
      ["launch", "tanker-launch", "rendezvous", "mars-transfer-burn"],
    ]);
  });

  it("carries more mass on it than on any other Launch Vehicle, once it has been through Development", () => {
    const [vehicle] = refuelled;
    const others = launchVehicles.filter((other) => other !== vehicle);
    expect(vehicle?.capacityTonnes).toBeGreaterThan(
      Math.max(...others.map(({ capacityTonnes }) => capacityTonnes)),
    );
    expect(vehicle?.technologyReadiness).toBe("not-built");
  });
});

describe("Mission Events in Earth orbit", () => {
  it("accepts a Launch Vehicle whose Mission Events in Earth orbit each have a day of their own", () => {
    expect(() => parseCatalogue(testCatalogueFiles())).not.toThrow();
  });

  it("rejects a Launch Vehicle with two Mission Events in Earth orbit on the same day, whose order would be unclear", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      missionEvents: files.missionEvents.map((event) =>
        event.id === "test-rendezvous"
          ? { ...event, timing: { from: "launch", days: 1 } }
          : event,
      ),
    });
    expect(message).toContain(
      `launch-vehicles.json: "test-refuelled" has more than one Mission Event in Earth orbit on day 1 after launch`,
    );
  });

  it("rejects a Launch Vehicle whose Mission would not have made its Mars transfer burn before the shortest Trajectory arrives", () => {
    // The Fast Trajectory arrives on day 120, and the burn is on the day after the rendezvous.
    expect(() => parseCatalogue(withRendezvousOn(118))).not.toThrow();
    expect(errorFrom(withRendezvousOn(119))).toContain(
      `launch-vehicles.json: "test-refuelled" has Mission Events near Earth until day 120, which must end before the shortest Trajectory arrives, on day 120`,
    );
  });
});

function withRendezvousOn(day: number) {
  const files = testCatalogueFiles();
  return {
    ...files,
    missionEvents: files.missionEvents.map((event) =>
      event.id === "test-rendezvous"
        ? { ...event, timing: { from: "launch" as const, days: day } }
        : event,
    ),
  };
}

describe("Mission Events timed from leaving Mars", () => {
  const journeyHome = {
    id: "test-earth-entry",
    name: "Test Earth entry",
    description: "Splashes down.",
    failureDescription: "The heat shield failed.",
    timing: { from: "leavingMars" as const, days: 180 },
    failureProbability: 0,
    publicSupportLoss: 30,
  };

  it("accepts one that nothing flying to Mars brings, for a journey home", () => {
    const files = testCatalogueFiles();
    expect(() =>
      parseCatalogue({
        ...files,
        missionEvents: [...files.missionEvents, journeyHome],
      }),
    ).not.toThrow();
  });

  it("rejects a Launch Vehicle, Asset or Crewed Mission that brings one on the way to Mars", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      missionEvents: [...files.missionEvents, journeyHome],
      launchVehicles: files.launchVehicles.map((vehicle, index) =>
        index === 0
          ? {
              ...vehicle,
              missionEvents: [...vehicle.missionEvents, journeyHome.id],
            }
          : vehicle,
      ),
      assets: files.assets.map((asset, index) =>
        index === 0
          ? {
              ...asset,
              missionEvents: [...asset.missionEvents, journeyHome.id],
            }
          : asset,
      ),
      crew: {
        ...files.crew,
        landingMissionEvents: [
          ...files.crew.landingMissionEvents,
          journeyHome.id,
        ],
      },
    });
    const [vehicle] = files.launchVehicles;
    const [asset] = files.assets;
    expect(message).toContain(
      `launch-vehicles.json: "${vehicle?.id ?? ""}" brings the Mission Event "test-earth-entry", which is timed from leaving Mars, on the way to Mars`,
    );
    expect(message).toContain(
      `assets.json: "${asset?.id ?? ""}" brings the Mission Event "test-earth-entry", which is timed from leaving Mars, on the way to Mars`,
    );
    expect(message).toContain(
      `crew.json: the Crewed Mission brings the Mission Event "test-earth-entry", which is timed from leaving Mars, on the way to Mars`,
    );
  });
});
