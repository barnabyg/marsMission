import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../../catalogue/catalogue";
import type { AssetAtMars, Timeline } from "../../simulation/simulation";
import { realCatalogueFiles } from "../../testing/realCatalogue";
import {
  describeSite,
  landingShot,
  landingsOnTheirWay,
  placeOf,
  siteShown,
  sitesToShow,
  spotOf,
  surfaceAssetsAt,
  surfaceCentre,
  surfaceShot,
} from "./surface";
import { groundHeight } from "./terrain";

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];

const asset = (overrides: Partial<AssetAtMars>): AssetAtMars => ({
  key: "lander",
  name: "Lander",
  kind: "lander",
  landingSiteName: "Alpha Plain",
  activityName: "Nothing",
  surfaceMotion: "still",
  arrivedOnDay: -100,
  fromDay: 0,
  untilDay: null,
  ...overrides,
});

const onTheWay = (overrides: Partial<MissionAsset>): MissionAsset => ({
  name: "Newcomer",
  kind: "lander",
  landingSiteName: "Beta Basin",
  deliveredOnDay: 205,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

const timelineOf = (
  assetsAtMars: AssetAtMars[],
  assets: MissionAsset[] = [],
): Pick<Timeline, "assetsAtMars" | "mission"> => ({
  assetsAtMars,
  mission:
    assets.length === 0
      ? null
      : {
          launchDay: 0,
          arrivalDay: 200,
          launchVehicleName: "Test Vehicle",
          assetNames: assets.map(({ name }) => name),
          assets,
          failedOnDay: null,
        },
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

  it("tells a rover from a lander, and treats anything else that lands as standing still", () => {
    const shown = surfaceAssetsAt(
      {
        assetsAtMars: [
          asset({ name: "L" }),
          asset({ name: "R", kind: "rover" }),
          asset({ name: "H", kind: "habitat" }),
        ],
      },
      10,
      "Alpha Plain",
    );
    expect(shown.map(({ model }) => model)).toEqual([
      "lander",
      "rover",
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

describe("the Landing Sites there are to show", () => {
  const older = asset({ name: "Old", arrivedOnDay: -900 });
  const newer = asset({
    name: "New",
    landingSiteName: "Beta Basin",
    arrivedOnDay: -100,
  });

  it("is none with nothing on the surface and no landing on its way", () => {
    expect(sitesToShow(timelineOf([]), 10)).toEqual([]);
    expect(
      sitesToShow(
        timelineOf([asset({ kind: "orbiter", landingSiteName: null })]),
        10,
      ),
    ).toEqual([]);
  });

  it("puts the site of the latest landing first, wherever it comes in the Timeline", () => {
    expect(sitesToShow(timelineOf([older, newer]), 10)).toEqual([
      "Beta Basin",
      "Alpha Plain",
    ]);
    expect(sitesToShow(timelineOf([newer, older]), 10)).toEqual([
      "Beta Basin",
      "Alpha Plain",
    ]);
  });

  it("counts a site by the latest landing still operating there", () => {
    const again = asset({ name: "Again", arrivedOnDay: -50 });
    expect(sitesToShow(timelineOf([newer, older, again]), 10)).toEqual([
      "Alpha Plain",
      "Beta Basin",
    ]);
    const stopped = asset({ name: "Again", arrivedOnDay: -50, untilDay: 5 });
    expect(sitesToShow(timelineOf([newer, older, stopped]), 10)).toEqual([
      "Beta Basin",
      "Alpha Plain",
    ]);
  });

  it("is the destination, with nothing there yet, if only a landing on its way is", () => {
    const timeline = timelineOf([], [onTheWay({})]);
    expect(sitesToShow(timeline, 0)).toEqual(["Beta Basin"]);
  });

  it("keeps the latest actual landing first until this Turn's Mission has landed, with its destination after", () => {
    const timeline = timelineOf(
      [
        older,
        asset({
          name: "Newcomer",
          landingSiteName: "Beta Basin",
          arrivedOnDay: 205,
          fromDay: 205,
        }),
      ],
      [onTheWay({})],
    );
    expect(sitesToShow(timeline, 100)).toEqual(["Alpha Plain", "Beta Basin"]);
    expect(sitesToShow(timeline, 205)).toEqual(["Beta Basin", "Alpha Plain"]);
  });

  it("lists the destination only once if it already has Assets", () => {
    const here = asset({ landingSiteName: "Beta Basin" });
    expect(sitesToShow(timelineOf([here], [onTheWay({})]), 10)).toEqual([
      "Beta Basin",
    ]);
  });

  it("loses the destination when the only landing on its way crashes, and never counts the crash as a landing", () => {
    const crash = onTheWay({
      deliveredOnDay: null,
      lostOnDay: 205,
      crashed: true,
    });
    const timeline = timelineOf([], [crash]);
    expect(sitesToShow(timeline, 204)).toEqual(["Beta Basin"]);
    expect(sitesToShow(timeline, 205)).toEqual([]);
    expect(sitesToShow(timeline, 300)).toEqual([]);
  });

  it("falls back to older sites when a landing elsewhere crashes", () => {
    const crash = onTheWay({
      deliveredOnDay: null,
      lostOnDay: 205,
      crashed: true,
    });
    const timeline = timelineOf([older], [crash]);
    expect(sitesToShow(timeline, 204)).toEqual(["Alpha Plain", "Beta Basin"]);
    expect(sitesToShow(timeline, 205)).toEqual(["Alpha Plain"]);
  });

  it("is none once the last Asset has stopped", () => {
    const stopping = asset({ untilDay: 300 });
    expect(sitesToShow(timelineOf([stopping]), 299)).toEqual(["Alpha Plain"]);
    expect(sitesToShow(timelineOf([stopping]), 300)).toEqual([]);
  });
});

describe("the Landing Site shown", () => {
  const sites = ["Beta Basin", "Alpha Plain"];

  it("is the latest landing until the player picks one", () => {
    expect(siteShown(sites, null)).toBe("Beta Basin");
  });

  it("is the player's pick for as long as it is there to show", () => {
    expect(siteShown(sites, "Alpha Plain")).toBe("Alpha Plain");
  });

  it("goes back to the latest landing when the player's pick has gone", () => {
    expect(siteShown(sites, "Gone Crater")).toBe("Beta Basin");
  });

  it("is nothing when there are no sites", () => {
    expect(siteShown([], "Alpha Plain")).toBeNull();
  });
});

describe("what the player reads about the Landing Site shown", () => {
  it("names each Asset operating there with its kind, and its Activity", () => {
    const timeline = timelineOf([
      asset({ name: "Prospector", activityName: "Surface research" }),
      asset({
        name: "Trailblazer",
        kind: "rover",
        activityName: "Soil analysis",
      }),
    ]);
    expect(describeSite(timeline, 10, "Alpha Plain")).toEqual([
      "Prospector (lander): Surface research",
      "Trailblazer (rover): Soil analysis",
    ]);
  });

  it("says when nothing has got there yet, and what is on its way", () => {
    const timeline = timelineOf([], [onTheWay({})]);
    expect(describeSite(timeline, 10, "Beta Basin")).toEqual([
      "Nothing here yet",
      "On its way: Newcomer",
    ]);
  });

  it("says nothing is operating at the site of a crash from the day it happens", () => {
    const crash = onTheWay({
      deliveredOnDay: null,
      lostOnDay: 205,
      crashed: true,
    });
    const timeline = timelineOf([], [crash]);
    expect(describeSite(timeline, 204, "Beta Basin")[0]).toBe(
      "Nothing here yet",
    );
    expect(describeSite(timeline, 205, "Beta Basin")).toEqual([
      "Nothing operating here",
    ]);
    expect(describeSite(timeline, 205, "Alpha Plain")).toEqual([
      "Nothing here yet",
    ]);
  });

  it("adds what is on its way to what is already there", () => {
    const timeline = timelineOf(
      [asset({ name: "Old", landingSiteName: "Beta Basin" })],
      [onTheWay({})],
    );
    expect(describeSite(timeline, 10, "Beta Basin")).toEqual([
      "Old (lander): Nothing",
      "On its way: Newcomer",
    ]);
  });

  it("leaves out a landing on its way to another site", () => {
    const timeline = timelineOf([asset({ name: "Old" })], [onTheWay({})]);
    expect(describeSite(timeline, 10, "Alpha Plain")).toEqual([
      "Old (lander): Nothing",
    ]);
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
