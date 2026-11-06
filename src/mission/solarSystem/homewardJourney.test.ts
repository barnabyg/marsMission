import { describe, expect, it } from "vitest";
import type { Homeward } from "../homeward";
import { homewardLabel, homewardOnDay } from "./homewardJourney";

const homeward = (
  departureFailed = false,
  entryDay: number | null = 270,
): Homeward => ({
  aboard: "crew",
  siteName: null,
  vehicleName: "Earth return stage",
  leavesOnDay: 60,
  homeOnDay: 270,
  moments: {
    departure: { entryIndex: 0, day: 62, failed: departureFailed },
    ...(entryDay === null
      ? {}
      : { entry: { entryIndex: 1, day: entryDay, failed: false } }),
  },
});

describe("the journey home in the solar system", () => {
  it("shows nothing until it leaves Mars orbit, or if it never does", () => {
    expect(homewardOnDay(homeward(), 61)).toBeNull();
    expect(homewardOnDay(homeward(true), 100)).toBeNull();
    expect(homewardOnDay(null, 100)).toBeNull();
  });

  it("goes from Mars on the day it leaves to Earth on the day it comes in", () => {
    expect(homewardOnDay(homeward(), 62)).toMatchObject({
      fromDay: 62,
      toDay: 270,
      onItsWay: true,
      progress: 0,
    });
    expect(homewardOnDay(homeward(), 166)?.progress).toBeCloseTo(0.5);
  });

  it("is gone from the way at Earth entry, leaving its path", () => {
    expect(homewardOnDay(homeward(), 270)).toMatchObject({
      onItsWay: false,
      progress: 1,
    });
  });

  it("heads for the day it would get home if the Timeline stops before Earth entry", () => {
    expect(homewardOnDay(homeward(false, null), 100)?.toDay).toBe(270);
  });

  it("names what brings it home and what it carries", () => {
    expect(
      homewardLabel({ crewed: true, vehicleName: "Earth return stage" }),
    ).toBe("Earth return stage: Crew heading home");
    expect(
      homewardLabel({ crewed: false, vehicleName: "Albatross Orbiter" }),
    ).toBe("Albatross Orbiter: samples heading home");
  });
});
