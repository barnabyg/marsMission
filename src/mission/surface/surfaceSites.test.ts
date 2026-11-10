import { describe, expect, it } from "vitest";
import { describeSite, siteShown, sitesToShow } from "./surface";
import { asset, onTheWay, timelineOf } from "./surfaceTestHelpers";

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

  it("says nothing is operating at a site that what was there has left through Mars ascent", () => {
    expect(describeSite(timelineOf([]), 70, "Alpha Plain", true)).toEqual([
      "Nothing operating here",
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

  it("says when an Asset's Service Life was cut, as the rest of the box no longer lists it", () => {
    const timeline = timelineOf([
      asset({ name: "Prospector", cutServiceLifeDays: 780 }),
    ]);
    expect(describeSite(timeline, 10, "Alpha Plain")).toEqual([
      "Prospector (lander): Nothing, Service Life cut to 780 days",
    ]);
  });

  it("leaves what is landing now to the landing's own line, which names it", () => {
    const timeline = timelineOf([
      asset({ name: "Old" }),
      asset({ name: "New", key: "new", arrivedOnDay: 205, fromDay: 205 }),
    ]);
    expect(describeSite(timeline, 205, "Alpha Plain", false, 205)).toEqual([
      "Old (lander): Nothing",
    ]);
    const alone = timelineOf([
      asset({ name: "New", arrivedOnDay: 205, fromDay: 205 }),
    ]);
    expect(describeSite(alone, 205, "Alpha Plain", false, 205)).toEqual([]);
  });

  it("leaves out a landing on its way to another site", () => {
    const timeline = timelineOf([asset({ name: "Old" })], [onTheWay({})]);
    expect(describeSite(timeline, 10, "Alpha Plain")).toEqual([
      "Old (lander): Nothing",
    ]);
  });
});
