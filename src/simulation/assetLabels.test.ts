import { describe, expect, it } from "vitest";
import { labelsFor } from "./assetLabels";

const orbiter = (arrivedOn: string) => ({
  assetId: "pathfinder-orbiter",
  name: "Pathfinder Orbiter",
  arrivedOn,
});

describe("how Assets at Mars are labelled", () => {
  it("leaves the only Asset of its kind with its name alone", () => {
    expect(
      labelsFor([
        orbiter("2031-01-01"),
        {
          assetId: "rover",
          name: "Trailblazer Rover",
          arrivedOn: "2031-01-01",
        },
      ]),
    ).toEqual(["Pathfinder Orbiter", "Trailblazer Rover"]);
  });

  it("numbers Assets of the same kind in the order they arrived, whatever order they're listed in", () => {
    expect(
      labelsFor([
        orbiter("2035-06-01"),
        {
          assetId: "rover",
          name: "Trailblazer Rover",
          arrivedOn: "2033-01-01",
        },
        orbiter("2031-01-01"),
        orbiter("2033-01-01"),
      ]),
    ).toEqual([
      "Pathfinder Orbiter 3",
      "Trailblazer Rover",
      "Pathfinder Orbiter 1",
      "Pathfinder Orbiter 2",
    ]);
  });

  it("keeps two that arrived on the same day apart, in the order they're listed", () => {
    expect(labelsFor([orbiter("2031-01-01"), orbiter("2031-01-01")])).toEqual([
      "Pathfinder Orbiter 1",
      "Pathfinder Orbiter 2",
    ]);
  });
});
