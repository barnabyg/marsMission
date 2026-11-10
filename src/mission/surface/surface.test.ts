import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../../catalogue/catalogue";
import type { AssetAtMars } from "../../simulation/simulation";
import { realCatalogueFiles } from "../../testing/realCatalogue";
import {
  landingShot,
  landingsOnTheirWay,
  modelOf,
  placeOf,
  spotOf,
  surfaceAssetsAt,
  surfaceCentre,
  surfaceShot,
} from "./surface";
import { asset, onTheWay, type MissionAsset } from "./surfaceTestHelpers";
import { groundHeight } from "./terrain";

describe("the model each kind of Asset stands on the surface as", () => {
  it("has one of its own for each kind that lands in the data files", () => {
    const landing = realCatalogueFiles()
      .assets.filter(
        ({ kind }) => kind !== "orbiter" && kind !== "return-orbiter",
      )
      .map(({ kind }) => [kind, modelOf(kind)]);
    expect(Object.fromEntries(landing)).toEqual({
      lander: "lander",
      rover: "rover",
      "fuel-plant": "fuelPlant",
      habitat: "habitat",
      lab: "lab",
      "ascent-vehicle": "ascentVehicle",
    });
    expect(modelOf("crew")).toBe("crewLander");
  });
});

describe("the Assets on show at a Landing Site", () => {
  const namesAt = (assets: AssetAtMars[], day: number) =>
    surfaceAssetsAt({ assetsAtMars: assets }, day, "Alpha Plain").map(
      ({ name }) => name,
    );

  it("includes one that arrives during the Turn, from the day it is delivered", () => {
    const arriving = [asset({ arrivedOnDay: 205, fromDay: 205 })];
    expect(namesAt(arriving, 204.9)).toEqual([]);
    expect(namesAt(arriving, 205)).toEqual(["Lander"]);
  });

  it.each(["its Service Life ends", "it fails"])(
    "leaves out one from the day %s",
    () => {
      const stopping = [asset({ untilDay: 300 })];
      expect(namesAt(stopping, 299.9)).toEqual(["Lander"]);
      expect(namesAt(stopping, 300)).toEqual([]);
    },
  );

  it("never shows one whose Service Life had passed before the Turn began", () => {
    expect(namesAt([asset({ untilDay: 0 })], 0)).toEqual([]);
  });

  it("leaves out orbiters and other Landing Sites", () => {
    expect(
      namesAt(
        [
          asset({ name: "Orbiter", kind: "orbiter", landingSiteName: null }),
          asset({ name: "Elsewhere", landingSiteName: "Beta Basin" }),
          asset({ name: "Here" }),
        ],
        10,
      ),
    ).toEqual(["Here"]);
  });

  it("gives each kind with a model of its own that model, and stands anything else that lands as a lander", () => {
    const shown = surfaceAssetsAt(
      {
        assetsAtMars: [
          asset({ name: "L" }),
          asset({ name: "R", kind: "rover" }),
          asset({ name: "H", kind: "habitat" }),
          asset({ name: "S", kind: "seismometer" }),
        ],
      },
      10,
      "Alpha Plain",
    );
    expect(shown.map(({ model }) => model)).toEqual([
      "lander",
      "rover",
      "habitat",
      "lander",
    ]);
  });

  it("keeps each one's place when another stops, so that it doesn't jump", () => {
    const assets = [
      asset({ name: "First", untilDay: 300 }),
      asset({ name: "Second" }),
    ];
    const placeOfSecond = (day: number) =>
      surfaceAssetsAt({ assetsAtMars: assets }, day, "Alpha Plain").find(
        ({ name }) => name === "Second",
      )?.place;
    expect(placeOfSecond(299)).toBe(1);
    expect(placeOfSecond(301)).toBe(1);
  });

  it("numbers places at each Landing Site separately, so that the first is always in the middle of the shot", () => {
    const assets = [
      asset({ name: "Elsewhere", landingSiteName: "Beta Basin" }),
      asset({ name: "Here" }),
    ];
    expect(
      surfaceAssetsAt({ assetsAtMars: assets }, 10, "Alpha Plain")[0]?.place,
    ).toBe(0);
  });

  it("gives every place its own spot, far enough apart for two models", () => {
    const places = Array.from({ length: 12 }, (_, place) => placeOf(place));
    places.forEach((one, index) => {
      places.slice(index + 1).forEach((other) => {
        expect(Math.hypot(one.x - other.x, one.z - other.z)).toBeGreaterThan(2);
      });
    });
  });
});

describe("where an Asset on show is on the ground", () => {
  const spotAt = (overrides: Partial<AssetAtMars>, day: number) => {
    const [shown] = surfaceAssetsAt(
      { assetsAtMars: [asset({ surfaceMotion: "traverse", ...overrides })] },
      day,
      "Alpha Plain",
    );
    if (!shown) throw new Error("Expected it to be on show");
    return spotOf(shown, day);
  };

  it("moves a rover on a Long traverse", () => {
    const rover = { kind: "rover" };
    expect(spotAt(rover, 500).x).not.toBeCloseTo(spotAt(rover, 300).x, 1);
  });

  it("keeps anything else at its place, whatever its Activity", () => {
    expect(spotAt({}, 500)).toEqual({ ...placeOf(0), heading: 0 });
    expect(spotAt({ kind: "habitat" }, 500)).toEqual({
      ...placeOf(0),
      heading: 0,
    });
  });
});

describe("the landings on their way", () => {
  const mission = (asset: Partial<MissionAsset>) => ({
    assets: [onTheWay(asset)],
  });

  it("lists one until the day it is delivered", () => {
    expect(landingsOnTheirWay(mission({}), 0)).toEqual([
      { name: "Newcomer", siteName: "Beta Basin" },
    ]);
    expect(landingsOnTheirWay(mission({}), 204.9)).toHaveLength(1);
    expect(landingsOnTheirWay(mission({}), 205)).toEqual([]);
  });

  it("stops listing one on the day it is lost, or from the start if lost at launch", () => {
    const lost = { deliveredOnDay: null, lostOnDay: 200 };
    expect(landingsOnTheirWay(mission(lost), 199.9)).toHaveLength(1);
    expect(landingsOnTheirWay(mission(lost), 200)).toEqual([]);
    const atLaunch = { deliveredOnDay: null, lostOnDay: 0 };
    expect(landingsOnTheirWay(mission(atLaunch), 0)).toEqual([]);
  });

  it("stops listing a crash on the day it crashes", () => {
    const crash = { deliveredOnDay: null, lostOnDay: 205, crashed: true };
    expect(landingsOnTheirWay(mission(crash), 204.9)).toHaveLength(1);
    expect(landingsOnTheirWay(mission(crash), 205)).toEqual([]);
  });

  it("leaves out anything that isn't landing, and a Turn with no Mission", () => {
    expect(landingsOnTheirWay(mission({ landingSiteName: null }), 10)).toEqual(
      [],
    );
    expect(landingsOnTheirWay(null, 10)).toEqual([]);
  });
});

describe("the surface view's shots", () => {
  const siteNames = parseCatalogue(realCatalogueFiles()).landingSites.map(
    ({ name }) => name,
  );

  it.each([
    ["usual", surfaceShot],
    ["landing", landingShot],
  ])("keep the %s camera above the ground at every Landing Site", (_, shot) => {
    const [x, y, z] = shot.position;
    for (const siteName of siteNames) {
      expect(y).toBeGreaterThan(
        groundHeight(siteName, x, z - surfaceCentre[2]) + 0.3,
      );
    }
  });
});
