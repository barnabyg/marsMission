import { describe, expect, it } from "vitest";
import { activityEarnings } from "./choiceText";
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
      activityEarnings(
        activity({ science: 80, publicSupport: 9, researchGrantMillions: 800 }),
      ),
    ).toBe(
      "earns 80 Science, 9 Public Support and $800M Research Grant a Turn",
    );
  });

  it("leaves out what it earns none of", () => {
    expect(
      activityEarnings(
        activity({ science: 80, publicSupport: 6, researchGrantMillions: 0 }),
      ),
    ).toBe("earns 80 Science and 6 Public Support a Turn");
    expect(
      activityEarnings(
        activity({ science: 0, publicSupport: 0, researchGrantMillions: 40 }),
      ),
    ).toBe("earns $40M Research Grant a Turn");
  });

  it("says plainly when it earns nothing", () => {
    expect(activityEarnings(activity(null))).toBe("earns nothing");
    expect(
      activityEarnings(
        activity({ science: 0, publicSupport: 0, researchGrantMillions: 0 }),
      ),
    ).toBe("earns nothing");
  });

  it("gives the samples a Sample caching collects", () => {
    expect(
      activityEarnings(activity(null, { samples: 10, science: 500 })),
    ).toBe("collects 10 samples a Turn");
  });
});
