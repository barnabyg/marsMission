import { describe, expect, it } from "vitest";
import type { PlannedActivity } from "../simulation/simulation";
import { chosenYields } from "./ActivitySelect";

const activity = (
  id: string,
  fields: Partial<PlannedActivity> = {},
): PlannedActivity => ({
  id,
  name: id,
  description: "Does something.",
  surveys: false,
  earnsPerTurn: null,
  cachesPerTurn: null,
  ...fields,
});

const earning = (science: number, grant = 0) => ({
  science,
  publicSupport: 0,
  researchGrantMillions: grant,
});

describe("chosenYields", () => {
  const activities = [
    activity("survey", { surveys: true }),
    activity("idle", { earnsPerTurn: earning(0) }),
    activity("research", { earnsPerTurn: earning(80) }),
    activity("grant", { earnsPerTurn: earning(0, 50) }),
    activity("caching", { cachesPerTurn: { samples: 10, science: 40 } }),
  ];

  it("is true for an Activity that earns or caches something", () => {
    for (const id of ["research", "grant", "caching"]) {
      expect(chosenYields(id, activities)).toBe(true);
    }
  });

  it("is false for a Survey, research that earns nothing and an unknown Activity", () => {
    for (const id of ["survey", "idle", "missing"]) {
      expect(chosenYields(id, activities)).toBe(false);
    }
  });
});
