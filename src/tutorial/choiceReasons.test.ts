import { describe, expect, it } from "vitest";
import { succeeding } from "../testing/realBalance";
import type { PlannedActivity } from "../simulation/simulation";
import { bestActivityReason } from "./choiceReasons";
import { followAdvice, startOf } from "./testHelpers";
import { crewAtBase, type AdviceItem, type AdviceTopic } from "./tutorial";

/* The tutorial's reasons for Service Life and Activities name figures that Planning Mode shows beside those choices. */

const reasonsFor = (items: AdviceItem[], topic: AdviceTopic, advice: string) =>
  items
    .filter((item) => item.topic === topic && item.advice === advice)
    .map(({ reason }) => reason);

describe("the reasons for Service Life and Activities", () => {
  const route = followAdvice(
    succeeding,
    succeeding.startProgram(1),
    ({ view }) => crewAtBase(view),
  );
  const items = route.flatMap(({ advice }) => advice.items);

  it("says a longer Service Life for the first orbiter would earn no Research Grants for its cost and Upkeep", () => {
    const first = startOf(succeeding, succeeding.startProgram(1));
    expect(
      reasonsFor(
        first.advice.items,
        "serviceLife",
        "Keep the shortest Service Life for Pathfinder Orbiter.",
      ),
    ).toEqual([
      "Pathfinder Orbiter's longest Service Life, 2,100 days, wouldn't pay for itself: +800 days (about 1 Turn) earn $0M in Research Grants against $150M and $10M Upkeep. Only Research Grants pay towards a longer Service Life and its Upkeep, as Science and Public Support aren't money.",
    ]);
  });

  it("says what the rovers' longest Service Life earns against its cost and Upkeep", () => {
    const reasons = reasonsFor(
      items,
      "serviceLife",
      "Buy the longest Service Life for Trailblazer Rover.",
    );
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toMatch(
        /^Trailblazer Rover's longest Service Life, 2,800 days, pays for itself: \+1,500 days \(about 1\.9 Turns\) earn \$[\d.]+[MB] in Research Grants against \$300M and \$\d+M Upkeep\.$/,
      );
    }
  });

  it("names each part of the Base and what its longest Service Life adds", () => {
    expect(
      reasonsFor(
        items,
        "serviceLife",
        "Buy the longest Service Life for Wellspring Fuel Plant, Haven Module and Curie Station.",
      ),
    ).toContainEqual(
      "The Base counts only while all of it operates, so its parts must last until Crew arrive: Wellspring Fuel Plant's 3,600 days add 1,500 days (about 1.9 Turns), Haven Module's 3,600 days add 1,500 days (about 1.9 Turns) and Curie Station's 3,600 days add 1,500 days (about 1.9 Turns).",
    );
  });

  it("names the Science an orbiter's research earns against its other Activities", () => {
    expect(
      reasonsFor(items, "activities", "Set Courier Relay to Orbital research."),
    ).toContainEqual(
      "Orbital research earns the most Science of Courier Relay's Activities: 80 a Turn, where the others earn none.",
    );
  });

  it("names the Research Grant a rover's research pays against its other Activities", () => {
    const reasons = reasonsFor(
      items,
      "activities",
      "Set Trailblazer Rover to Soil analysis.",
    );
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toMatch(
        /^Soil analysis pays the biggest Research Grant of Trailblazer Rover's Activities: \$[\d.]+[MB] a Turn, where the others pay none\.$/,
      );
    }
  });

  it("never says an Activity earns the most without saying of what", () => {
    for (const { reason } of items) {
      expect(reason).not.toMatch(/the most of what/);
    }
  });
});

/** An Activity on offer that earns this much a Turn, or caches these samples. */
const offered = (
  name: string,
  [science, publicSupport, researchGrantMillions]: number[] = [],
  samples?: number,
): PlannedActivity => ({
  id: name,
  name,
  description: "",
  surveys: false,
  earnsPerTurn:
    science === undefined
      ? null
      : {
          science,
          publicSupport: publicSupport ?? 0,
          researchGrantMillions: researchGrantMillions ?? 0,
        },
  cachesPerTurn: samples === undefined ? null : { samples, science: 500 },
});

describe("why an Activity is the one to choose", () => {
  const soil = offered("Soil analysis", [80, 9, 800]);
  const traverse = offered("Long traverse", [160, 14, 0]);
  const surface = offered("Surface research", [100, 9, 50]);
  const caching = offered("Sample caching", undefined, 10);
  const nothing = offered("Nothing");

  it("names the Research Grant when it pays the biggest", () => {
    expect(
      bestActivityReason("Rover", soil, [soil, surface, caching, nothing]),
    ).toBe(
      "Soil analysis pays the biggest Research Grant of Rover's Activities: $800M a Turn, against $50M for Surface research.",
    );
  });

  it("names the Science when it earns the most of that but not the biggest Research Grant", () => {
    expect(
      bestActivityReason("Rover", traverse, [soil, traverse, caching, nothing]),
    ).toBe(
      "Long traverse earns the most Science of Rover's Activities: 160 a Turn, against 80 for Soil analysis.",
    );
  });

  it("names the Public Support when it leads only on that", () => {
    const quiet = offered("Quiet research", [80, 6, 0]);
    const loud = offered("Loud research", [80, 12, 0]);
    expect(bestActivityReason("Orbiter", loud, [quiet, loud])).toBe(
      "Loud research earns the most Public Support of Orbiter's Activities: 12 a Turn, against 6 for Quiet research.",
    );
  });

  it("claims no most for an Activity that leads on nothing, and says what it does", () => {
    expect(
      bestActivityReason("Rover", caching, [soil, traverse, caching, nothing]),
    ).toBe("Sample caching collects 10 samples a Turn.");
    const twin = offered("Twin research", [80, 6, 0]);
    expect(
      bestActivityReason("Orbiter", twin, [twin, offered("Other", [80, 6, 0])]),
    ).toBe("Twin research earns 80 Science and 6 Public Support a Turn.");
  });
});
