import { describe, expect, it } from "vitest";
import { groupByPlace } from "./operatingGroups";

const at = (label: string, landingSiteName: string | null) => ({
  label,
  landingSiteName,
});

describe("grouping the Assets at Mars by place", () => {
  it("puts Mars orbit first, then each Landing Site as its first Asset comes, keeping each group's order", () => {
    const groups = groupByPlace([
      at("Rover", "Jezero Crater"),
      at("Orbiter 1", null),
      at("Plant", "Gale Crater"),
      at("Lander", "Jezero Crater"),
      at("Orbiter 2", null),
    ]);
    expect(
      groups.map(({ place, assets }) => [
        place,
        assets.map(({ label }) => label),
      ]),
    ).toEqual([
      ["Mars orbit", ["Orbiter 1", "Orbiter 2"]],
      ["Jezero Crater", ["Rover", "Lander"]],
      ["Gale Crater", ["Plant"]],
    ]);
  });

  it("has no Mars orbit group when nothing is in orbit, and no groups when nothing is at Mars", () => {
    expect(
      groupByPlace([at("Rover", "Jezero Crater")]).map(({ place }) => place),
    ).toEqual(["Jezero Crater"]);
    expect(groupByPlace([])).toEqual([]);
  });
});
