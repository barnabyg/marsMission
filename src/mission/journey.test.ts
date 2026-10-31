import { describe, expect, it } from "vitest";
import type { Timeline } from "../simulation/simulation";
import { assetsOperatingOn, describeJourney } from "./journey";

const orbiter = {
  name: "Orbiter",
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
  it("adds each Asset from its day, with its Landing Site", () => {
    const timeline = {
      assetsAtMars: [
        { name: "Old", kind: "orbiter", landingSiteName: null, fromDay: 0 },
        {
          name: "New",
          kind: "lander",
          landingSiteName: "Alpha Plain",
          fromDay: 205,
        },
      ],
    } as unknown as Timeline;
    expect(assetsOperatingOn(timeline, 204)).toEqual(["Old"]);
    expect(assetsOperatingOn(timeline, 205)).toEqual([
      "Old",
      "New at Alpha Plain",
    ]);
  });
});
