import { describe, expect, it } from "vitest";
import { succeeding } from "../testing/realBalance";
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

  it("says a longer Service Life for the first orbiter would earn no Research Grants for its cost", () => {
    const first = startOf(succeeding, succeeding.startProgram(1));
    expect(
      reasonsFor(
        first.advice.items,
        "serviceLife",
        "Keep the shortest Service Life for Pathfinder Orbiter.",
      ),
    ).toEqual([
      "Pathfinder Orbiter's 2,100 days would add 800 days, about 1 Turn, earning $0M in Research Grants for $150M. Only Research Grants pay towards a longer Service Life, as Science and Public Support aren't money.",
    ]);
  });

  it("says what the rovers' longest Service Life earns against its cost", () => {
    const reasons = reasonsFor(
      items,
      "serviceLife",
      "Buy the longest Service Life for Trailblazer Rover.",
    );
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toMatch(
        /^Trailblazer Rover's 2,800 days add 1,500 days, about 1\.9 Turns, which earn \$[\d.]+[MB] in Research Grants for \$300M\.$/,
      );
    }
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
