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
