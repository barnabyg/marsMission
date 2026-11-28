import { describe, expect, it } from "vitest";
import { whatActivityDoes } from "./choiceText";
import type { PlannedActivity } from "./previews";

const activity = (
  earnsPerTurn: PlannedActivity["earnsPerTurn"],
  cachesPerTurn: PlannedActivity["cachesPerTurn"] = null,
): PlannedActivity => ({
  id: "test",
  name: "Test",
  description: "",
  surveys: false,
  earnsPerTurn,
  cachesPerTurn,
});

describe("what an Activity's choice says it earns", () => {
  it("lists Science, Public Support and Research Grant a Turn", () => {
    expect(
      whatActivityDoes(
        activity({ science: 80, publicSupport: 9, researchGrantMillions: 800 }),
      ),
    ).toBe(
      "earns 80 Science, 9 Public Support and $800M Research Grant a Turn",
    );
  });

  it("leaves out what it earns none of", () => {
    expect(
      whatActivityDoes(
        activity({ science: 80, publicSupport: 6, researchGrantMillions: 0 }),
      ),
    ).toBe("earns 80 Science and 6 Public Support a Turn");
    expect(
      whatActivityDoes(
        activity({ science: 0, publicSupport: 0, researchGrantMillions: 40 }),
      ),
    ).toBe("earns $40M Research Grant a Turn");
  });

  it("says what an Activity that earns nothing does: a Survey in short, and any other from its description", () => {
    const surveying = {
      ...activity(null),
      surveys: true,
      description:
        "Observes Mars from orbit, which lowers the landing risk of the known Landing Sites and reveals a new one.",
    };
    expect(whatActivityDoes(surveying)).toBe(
      "lowers the landing risk of later landings",
    );
    expect(
      whatActivityDoes({
        ...activity(null),
        description: "Stays in place and does no work this Turn.",
      }),
    ).toBe("stays in place and does no work this Turn");
  });

  it("gives a Survey's effect as things stand: each site's risk before and after, and a site revealed", () => {
    const surveying = (survey: PlannedActivity["survey"]) => ({
      ...activity(null),
      surveys: true,
      ...(survey ? { survey } : {}),
    });
    const site = (
      name: string,
      riskBand: string,
      surveyedRiskBand: string,
    ) => ({
      name,
      riskBand,
      surveyedRiskBand,
    });
    expect(
      whatActivityDoes(
        surveying({
          lowers: [
            site("Jezero Crater", "Over 30%", "~10%"),
            site("Gale Crater", "Over 30%", "~10%"),
            site("Elysium", "~20%", "~5%"),
          ],
          reveals: true,
        }),
      ),
    ).toBe(
      "lowers the landing risk of later landings at Jezero Crater and Gale Crater from Over 30% to ~10%, and at Elysium from ~20% to ~5%, and reveals a new Landing Site, already surveyed",
    );
    expect(whatActivityDoes(surveying({ lowers: [], reveals: true }))).toBe(
      "reveals a new Landing Site for later landings, already surveyed",
    );
    // Bands are rough, so a site can be safer and still in the same one.
    expect(
      whatActivityDoes(
        surveying({
          lowers: [site("Jezero Crater", "~10%", "~10%")],
          reveals: false,
        }),
      ),
    ).toBe(
      "lowers the landing risk of later landings at Jezero Crater a little, staying ~10%",
    );
    expect(whatActivityDoes(surveying({ lowers: [], reveals: false }))).toBe(
      "has nothing left to survey",
    );
  });

  it("says plainly when research earns nothing", () => {
    expect(
      whatActivityDoes(
        activity({ science: 0, publicSupport: 0, researchGrantMillions: 0 }),
      ),
    ).toBe("earns nothing");
  });

  it("gives the samples a Sample caching collects", () => {
    expect(
      whatActivityDoes(activity(null, { samples: 10, science: 500 })),
    ).toBe("collects 10 samples a Turn");
  });
});
