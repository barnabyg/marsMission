import { describe, expect, it } from "vitest";
import {
  benefitTag,
  benefitThisTurn,
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

const relay = {
  name: "Courier Relay",
  benefit:
    "Raises the Ongoing Research of every Asset and Crew on the surface.",
  benefitImpact: impact,
  grantImpact: null,
  makes: null,
  habitat: null,
};

describe("an Asset card's Benefit tag", () => {
  it("is left off an Asset with no Benefit", () => {
    expect(benefitTag({ ...relay, benefit: null, benefitImpact: null })).toBe(
      null,
    );
  });

  it("is left off while the Benefit would add nothing this Turn, which the details say instead", () => {
    expect(benefitTag(relay)).toBe(null);
    expect(benefitThisTurn(relay)).toBe(
      "It adds nothing this Turn, as nothing on the surface is doing research. It pays once Assets or Crew are.",
    );
    expect(
      benefitTag({
        ...relay,
        benefitImpact: null,
        grantImpact: { ...grantImpact, landingSiteName: null },
      }),
    ).toBe(null);
  });

  it("shows the Science or money the Benefit would add, with why in its tooltip after what the Benefit does", () => {
    expect(
      benefitTag({
        ...relay,
        benefitImpact: { ...impact, assets: 1, extraScience: 120 },
      }),
    ).toEqual({
      text: "Benefit +120 Science",
      detail: `Courier Relay: ${relay.benefit} This Turn it would raise the research of the 1 Asset on the surface, adding about 120 Science over a whole Turn.`,
    });
    expect(
      benefitTag({
        ...relay,
        name: "Curie Station",
        benefitImpact: null,
        grantImpact: { ...grantImpact, assets: 1, extraGrantMillions: 250 },
      })?.text,
    ).toBe("Benefit +$250M");
  });

  it("shows what a fuel plant makes and the days a Habitat adds, which don't depend on the Turn", () => {
    expect(
      benefitTag({
        ...relay,
        benefitImpact: null,
        makes: { ascentPropellantKgPerTurn: 1500 },
      })?.text,
    ).toBe("Benefit +1.5 t propellant");
    expect(
      benefitTag({
        ...relay,
        benefitImpact: null,
        habitat: {
          timeAtMarsCutPercent: 50,
          suppliesKg: 1500,
          extraDays: 1200,
        },
      })?.text,
    ).toBe("Benefit +1,200 days");
    expect(
      benefitThisTurn({
        ...relay,
        benefitImpact: null,
        habitat: {
          timeAtMarsCutPercent: 50,
          suppliesKg: 1500,
          extraDays: 1200,
        },
      }),
    ).toBe(null);
  });
});
