import { describe, expect, it } from "vitest";
import { contingencyLabel, reliabilityDetail } from "./riskWording";

const level = (name: string, riskBand: string) => ({
  id: name.toLowerCase(),
  name,
  costMillions: 0,
  riskBand,
});

describe("reliabilityDetail", () => {
  it("gives the Risk Band each Reliability level would leave", () => {
    expect(
      reliabilityDetail("Launch", [
        level("None", "~5%"),
        level("Tested", "~2%"),
        level("Redundant", "~1%"),
      ]),
    ).toBe("Launch with each level: None ~5% · Tested ~2% · Redundant ~1%.");
  });

  it("says a level that leaves the same band still lowers the chance, as bands are rough", () => {
    expect(
      reliabilityDetail("Mars orbit insertion", [
        level("None", "~10%"),
        level("Tested", "~5%"),
        level("Redundant", "~5%"),
      ]),
    ).toBe(
      "Mars orbit insertion with each level: None ~10% · Tested ~5% · Redundant ~5%. Risk Bands are rough, so a level in the same band as a cheaper one still lowers the chance within it.",
    );
  });
});

describe("contingencyLabel", () => {
  it("gives the cost and mass, and its Risk Band as the chance the second try fails", () => {
    expect(
      contingencyLabel({
        name: "Kick stage",
        costMillions: 60,
        massTonnes: 0.3,
        riskBand: "~20%",
      }),
    ).toBe("Kick stage · $60M · 0.3 t · ~20% chance it fails too");
    expect(
      contingencyLabel({
        name: "Reserve fuel",
        costMillions: 80,
        massTonnes: 0.2,
        riskBand: "Over 30%",
      }),
    ).toBe("Reserve fuel · $80M · 0.2 t · Over 30% chance it fails too");
  });
});
