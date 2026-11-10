import { describe, expect, it } from "vitest";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";

describe("invalid data files", () => {
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

  it("reject a Landing Site that isn't on the globe", () => {
    const files = testCatalogueFiles();
    const [site] = files.landingSites;
    const message = errorFrom({
      ...files,
      landingSites: [{ ...site, latitude: 100 }],
    });
    expect(message).toContain("latitude");
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

  it("reject a Contingency for a Mission Event that doesn't exist", () => {
    const files = testCatalogueFiles();
    const [first, ...rest] = files.contingencies;
    if (!first) throw new Error("Expected a Contingency");
    const message = errorFrom({
      ...files,
      contingencies: [{ ...first, missionEvent: "nope" }, ...rest],
    });
    expect(message).toContain("contingencies.json");
    expect(message).toContain('"nope"');
  });

  it("reject two Contingencies for one Mission Event", () => {
    const files = testCatalogueFiles();
    const [first] = files.contingencies;
    if (!first) throw new Error("Expected a Contingency");
    const message = errorFrom({
      ...files,
      contingencies: [first, { ...first, id: "another" }],
    });
    expect(message).toContain("more than one Contingency");
  });

  it("reject a Contingency with a negative mass or an impossible loss of Service Life", () => {
    const files = testCatalogueFiles();
    const [first, ...rest] = files.contingencies;
    if (!first) throw new Error("Expected a Contingency");
    const message = errorFrom({
      ...files,
      contingencies: [
        { ...first, massTonnes: -1, serviceLifeLossPercent: 100 },
        ...rest,
      ],
    });
    expect(message).toContain("massTonnes");
    expect(message).toContain("serviceLifeLossPercent");
  });

  it("reject having no Trajectory, or one with a negative loss of mass capacity", () => {
    const files = testCatalogueFiles();
    expect(errorFrom({ ...files, trajectories: [] })).toContain(
      "trajectories.json",
    );
    const [first] = files.trajectories;
    if (!first) throw new Error("Expected a Trajectory");
    expect(
      errorFrom({
        ...files,
        trajectories: [{ ...first, capacityLossTonnes: -1 }],
      }),
    ).toContain("capacityLossTonnes");
  });

  it("reject a Free-return with an unknown burn, no cost, an impossible refund or too long a return", () => {
    const files = testCatalogueFiles();
    const freeReturn = {
      arrivalBurn: "test-arrival",
      refundPercent: 50,
      returnDays: 300,
      description: "It comes home.",
    };
    const withFreeReturn = (
      changes: object,
      trajectory: object = { costMillions: 10 },
    ) =>
      errorFrom({
        ...files,
        trajectories: [
          {
            id: "route",
            name: "Route",
            description: "A route.",
            transferDays: 200,
            costMillions: 0,
            capacityLossTonnes: 0,
            ...trajectory,
            freeReturn: { ...freeReturn, ...changes },
          },
        ],
      });
    expect(withFreeReturn({ arrivalBurn: "nope" })).toContain('"nope"');
    expect(withFreeReturn({ refundPercent: 101 })).toContain("refundPercent");
    expect(withFreeReturn({ returnDays: 700 })).toContain("returnDays");
    expect(withFreeReturn({}, {})).toContain("must cost money or mass");
  });

  it("reject a transfer that wouldn't finish within the Turn", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      trajectories: [
        ...files.trajectories,
        {
          id: "too-slow",
          name: "Too slow",
          description: "Never gets there.",
          transferDays: 776,
          costMillions: 0,
          capacityLossTonnes: 0,
        },
      ],
    });
    expect(message).toContain("trajectories.json");
    expect(message).toContain('"too-slow"');
  });
});
