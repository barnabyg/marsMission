import { describe, expect, it } from "vitest";
import {
  describeBenefitImpact,
  describeGrantImpact,
} from "./benefitImpactText";

const impact = { assets: 0, crew: 0, extraScience: 0, alreadyGivenBy: [] };

describe("what a Benefit would add this Turn", () => {
  it("names what it would raise on the surface, and the Science it would add", () => {
    expect(
      describeBenefitImpact({
        ...impact,
        assets: 2,
        crew: 3,
        extraScience: 450,
      }),
    ).toBe(
      "This Turn it would raise the research of the 2 Assets and 3 Crew on the surface, adding about 450 Science over a whole Turn.",
    );
    expect(
      describeBenefitImpact({ ...impact, assets: 1, extraScience: 120 }),
    ).toContain("the 1 Asset on the surface");
  });

  it("says why it adds nothing", () => {
    expect(describeBenefitImpact(impact)).toBe(
      "It adds nothing this Turn, as nothing on the surface is doing research. It pays once Assets or Crew are.",
    );
    expect(
      describeBenefitImpact({
        ...impact,
        assets: 2,
        alreadyGivenBy: ["Courier Relay"],
      }),
    ).toBe(
      "It adds nothing this Turn, as Courier Relay at Mars already gives this Benefit.",
    );
  });
});

const grantImpact = {
  landingSiteName: "Jezero Crater",
  assets: 0,
  crew: 0,
  extraGrantMillions: 0,
  alreadyGivenBy: [],
};

describe("what a Mars lab's Benefit would add this Turn", () => {
  it("names the Landing Site, what it would raise there and the money it would add", () => {
    expect(
      describeGrantImpact({
        ...grantImpact,
        assets: 1,
        crew: 2,
        extraGrantMillions: 250,
      }),
    ).toBe(
      "Landed at Jezero Crater this Turn, it would raise the Research Grants of the 1 Asset and 2 Crew there, adding about $250M over a whole Turn.",
    );
  });

  it("says why it adds nothing", () => {
    expect(describeGrantImpact({ ...grantImpact, landingSiteName: null })).toBe(
      "It adds nothing this Turn, as nothing it raises at a Landing Site is earning a Research Grant. It pays once landed beside them.",
    );
    expect(
      describeGrantImpact({
        ...grantImpact,
        assets: 1,
        alreadyGivenBy: ["Curie Station"],
      }),
    ).toBe(
      "It adds nothing this Turn at Jezero Crater, the best place for it, as Curie Station there already gives this Benefit.",
    );
  });
});
