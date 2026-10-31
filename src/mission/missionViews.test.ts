import { describe, expect, it } from "vitest";
import { missionViews, viewName } from "./missionViews";

describe("Mission Mode's views", () => {
  it("offers the solar system first, because every Turn starts there", () => {
    expect(missionViews.map(({ id }) => id)).toEqual([
      "solarSystem",
      "marsOrbit",
    ]);
  });

  it("names each view for the player", () => {
    expect(viewName("solarSystem")).toBe("Solar system");
    expect(viewName("marsOrbit")).toBe("Mars orbit");
  });
});
