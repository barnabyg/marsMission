import { describe, expect, it } from "vitest";
import type { Timeline } from "../simulation/simulation";
import { assetsOperatingOn, describeJourney } from "./journey";

const orbiter = {
  name: "Orbiter",
  label: "Orbiter",
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

describe("describing a Mission's journey", () => {
  it("says when there is no Mission", () => {
    expect(describeJourney(null, 10)).toBe("No Mission this Turn");
  });

  it("gives progress on the way to Mars", () => {
    const flying = mission([{ ...orbiter, deliveredOnDay: 200 }]);
    expect(describeJourney(flying, 50)).toBe("Orbiter: 25% of the way to Mars");
    expect(describeJourney(flying, 200)).toBe("Orbiter: arrived at Mars");
  });

  it("names the Landing Site once a lander has landed, not before", () => {
    const landing = mission([{ ...lander, deliveredOnDay: 205 }]);
    expect(describeJourney(landing, 202)).toBe("Lander: arriving at Mars");
    expect(describeJourney(landing, 205)).toBe("Lander: landed at Alpha Plain");
  });

  it("reports a crash at the site, not a spacecraft that won't reach Mars", () => {
    const crashed = mission(
      [{ ...lander, lostOnDay: 205, crashed: true }],
      205,
    );
    expect(describeJourney(crashed, 205)).toBe(
      "Lander: crashed at Alpha Plain",
    );
  });

  it("reports a Mission lost on the way", () => {
    const lost = mission([{ ...orbiter, lostOnDay: 1 }], 1);
    expect(describeJourney(lost, 300)).toBe(
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
    expect(describeJourney(coming, 120)).toContain("50% of the way to Mars");
  });

  it("heads back rather than being lost, with everything on board", () => {
    expect(describeJourney(coming, 300)).toBe(
      "Test Orbiter: heading back to Earth. Test Lander: heading back to Earth",
    );
  });

  it("is back at Earth at the end", () => {
    expect(describeJourney(coming, 660)).toBe(
      "Test Orbiter: back at Earth. Test Lander: back at Earth",
    );
  });
});
