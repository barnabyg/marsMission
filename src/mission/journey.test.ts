import { describe, expect, it } from "vitest";
import type { Timeline } from "../simulation/simulation";
import { assetsOperatingOn, describeJourney } from "./journey";

const orbiter = {
  name: "Orbiter",
  kind: "orbiter",
  landingSiteName: null,
  deliveredOnDay: null,
  lostOnDay: null,
  crashed: false,
};
const lander = { ...orbiter, name: "Lander", landingSiteName: "Alpha Plain" };

function mission(
  assets: NonNullable<Timeline["mission"]>["assets"],
  failedOnDay: number | null = null,
): Timeline["mission"] {
  return {
    launchDay: 0,
    arrivalDay: 200,
    launchVehicleName: "Vehicle",
    assetNames: assets.map(({ name }) => name),
    assets,
    failedOnDay,
  };
}

/** What the Timeline says is operating at Mars: one Asset of the Mission, from the day it arrived. */
function operating(
  label: string,
  fromDay: number,
  landingSiteName: string | null = null,
): Timeline["assetsAtMars"][number] {
  return {
    key: label,
    name: label,
    label,
    kind: landingSiteName ? "lander" : "orbiter",
    landingSiteName,
    activityName: "Survey",
    surfaceMotion: "still",
    arrivedOnDay: fromDay,
    fromDay,
    untilDay: null,
  };
}

const journeyOf = (
  flying: Timeline["mission"],
  assetsAtMars: Timeline["assetsAtMars"] = [],
) => ({ mission: flying, assetsAtMars });

describe("describing a Mission's journey", () => {
  it("says when there is no Mission", () => {
    expect(describeJourney(journeyOf(null), 10)).toBe("No Mission this Turn");
  });

  it("says it's on its way to Mars, leaving how far to the Turn's progress bar", () => {
    const flying = mission([{ ...orbiter, deliveredOnDay: 200 }]);
    expect(describeJourney(journeyOf(flying), 50)).toBe(
      "Orbiter: on its way to Mars",
    );
  });

  it("leaves an Asset that has arrived to the list of what's operating at Mars", () => {
    const flying = mission([{ ...orbiter, deliveredOnDay: 205 }]);
    const there = journeyOf(flying, [operating("Orbiter", 205)]);
    expect(describeJourney(there, 202)).toBe("Orbiter: arriving at Mars");
    expect(describeJourney(there, 205)).toBeNull();
  });

  it("says an Asset arrived that isn't listed as operating", () => {
    const flying = mission([{ ...orbiter, deliveredOnDay: 200 }]);
    expect(describeJourney(journeyOf(flying), 200)).toBe(
      "Orbiter: arrived at Mars",
    );
  });

  it("names the Landing Site once a lander has landed, not before", () => {
    const landing = mission([{ ...lander, deliveredOnDay: 205 }]);
    expect(describeJourney(journeyOf(landing), 202)).toBe(
      "Lander: arriving at Mars",
    );
    expect(describeJourney(journeyOf(landing), 205)).toBe(
      "Lander: landed at Alpha Plain",
    );
  });

  it("leaves a landing on its way to the Landing Site shown to that site's own list", () => {
    const both = mission([
      { ...orbiter, deliveredOnDay: 200 },
      { ...lander, deliveredOnDay: 205 },
    ]);
    expect(describeJourney(journeyOf(both), 50, "Alpha Plain")).toBe(
      "Orbiter: on its way to Mars",
    );
    expect(describeJourney(journeyOf(both), 50, "Beta Basin")).toBe(
      "Orbiter, Lander: on its way to Mars",
    );
    const alone = mission([{ ...lander, deliveredOnDay: 205 }]);
    expect(describeJourney(journeyOf(alone), 50, "Alpha Plain")).toBeNull();
  });

  it("reports a crash at the site, not a spacecraft that won't reach Mars", () => {
    const crashed = mission(
      [{ ...lander, lostOnDay: 205, crashed: true }],
      205,
    );
    expect(describeJourney(journeyOf(crashed), 205, "Alpha Plain")).toBe(
      "Lander: crashed at Alpha Plain",
    );
  });

  it("reports a Mission lost on the way", () => {
    const lost = mission([{ ...orbiter, lostOnDay: 1 }], 1);
    expect(describeJourney(journeyOf(lost), 300)).toBe(
      "Orbiter: lost, and will not reach Mars",
    );
  });
});

describe("listing what's operating at Mars", () => {
  it("removes an Asset from the day it stops operating", () => {
    const timeline = {
      assetsAtMars: [
        {
          key: "ending",
          name: "Ending",
          label: "Ending",
          kind: "orbiter",
          landingSiteName: null,
          activityName: "Survey",
          surfaceMotion: "still" as const,
          arrivedOnDay: -100,
          fromDay: 0,
          untilDay: 300,
        },
      ],
    };
    expect(assetsOperatingOn(timeline, 299)).toEqual(["Ending: Survey"]);
    expect(assetsOperatingOn(timeline, 300)).toEqual([]);
  });

  it("adds each Asset from its day, with its Landing Site", () => {
    const timeline = {
      assetsAtMars: [
        {
          key: "old",
          name: "Old",
          label: "Old",
          kind: "orbiter",
          landingSiteName: null,
          activityName: "Survey",
          surfaceMotion: "still" as const,
          arrivedOnDay: -100,
          fromDay: 0,
          untilDay: null,
        },
        {
          key: "new",
          name: "New",
          label: "New",
          kind: "lander",
          landingSiteName: "Alpha Plain",
          activityName: "Nothing",
          surfaceMotion: "still" as const,
          arrivedOnDay: -100,
          fromDay: 205,
          untilDay: null,
        },
      ],
    };
    expect(assetsOperatingOn(timeline, 204)).toEqual(["Old: Survey"]);
    expect(assetsOperatingOn(timeline, 205)).toEqual([
      "Old: Survey",
      "New at Alpha Plain: Nothing",
    ]);
  });
  it("leaves the Assets at the Landing Site the surface view shows to that site's own list", () => {
    const timeline = {
      assetsAtMars: [
        operating("Orbiter", 0),
        operating("Lander", 0, "Alpha Plain"),
        operating("Rover", 0, "Beta Basin"),
      ],
    };
    expect(assetsOperatingOn(timeline, 10, "Alpha Plain")).toEqual([
      "Orbiter: Survey",
      "Rover at Beta Basin: Survey",
    ]);
  });
});

describe("a Mission coming home on a Free-return", () => {
  const coming = {
    launchDay: 0,
    arrivalDay: 240,
    launchVehicleName: "Test Vehicle",
    assetNames: ["Test Orbiter", "Test Lander"],
    assets: [
      {
        name: "Test Orbiter",
        label: "Test Orbiter",
        kind: "orbiter",
        landingSiteName: null,
        deliveredOnDay: null,
        lostOnDay: 240,
        crashed: false,
      },
      {
        name: "Test Lander",
        label: "Test Lander",
        kind: "lander",
        landingSiteName: "Alpha Plain",
        deliveredOnDay: null,
        lostOnDay: 240,
        crashed: false,
      },
    ],
    failedOnDay: 240,
    returnsToEarth: { fromDay: 240, backOnDay: 660 },
  };

  it("is on its way to Mars until the burn fails", () => {
    expect(describeJourney(journeyOf(coming), 120)).toContain(
      "on its way to Mars",
    );
  });

  it("heads back rather than being lost, with everything on board", () => {
    expect(describeJourney(journeyOf(coming), 300)).toBe(
      "Test Orbiter: heading back to Earth. Test Lander: heading back to Earth",
    );
  });

  it("is back at Earth at the end", () => {
    expect(describeJourney(journeyOf(coming), 660)).toBe(
      "Test Orbiter: back at Earth. Test Lander: back at Earth",
    );
  });
});
