import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../simulation/simulation";
import { soundFileNames, soundFor } from "./sounds";

function missionEvent(
  eventId: string,
  outcome: "success" | "failure",
): TimelineEntry {
  return {
    kind: "missionEvent",
    day: 0,
    eventId,
    title: eventId,
    description: "",
    outcome,
  };
}

describe("matching sounds to timeline entries", () => {
  it("plays the launch sound when a launch succeeds", () => {
    expect(soundFor(missionEvent("launch", "success"))).toBe("launch");
  });

  it("plays the failure sound for any Mission Event failing, launch included", () => {
    expect(soundFor(missionEvent("launch", "failure"))).toBe("failure");
    expect(soundFor(missionEvent("anything-else", "failure"))).toBe("failure");
  });

  it("plays the Milestone and Funding Threshold sounds", () => {
    const common = { day: 0, title: "", description: "" };
    expect(
      soundFor({ ...common, kind: "milestone", milestoneId: "first" }),
    ).toBe("milestone");
    expect(soundFor({ ...common, kind: "fundingThreshold" })).toBe(
      "fundingThreshold",
    );
  });

  it("leaves any other entry silent", () => {
    expect(soundFor(missionEvent("mars-transfer-burn", "success"))).toBeNull();
  });

  it("gives each sound its own file", () => {
    const files = Object.values(soundFileNames);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("sound files (ADR 0005)", () => {
  const sources = readFileSync("public/sounds/SOURCES.md", "utf8");
  const soundFiles = readdirSync("public/sounds").filter(
    (fileName) => fileName !== "SOURCES.md",
  );

  it.each(Object.values(soundFileNames))("includes %s", (fileName) => {
    expect(existsSync(`public/sounds/${fileName}`)).toBe(true);
  });

  it.each(soundFiles)("%s has its source and licence recorded", (fileName) => {
    const start = sources.indexOf(`## ${fileName}\n`);
    expect(start).not.toBe(-1);
    const end = sources.indexOf("\n## ", start + 1);
    const section = sources.slice(start, end === -1 ? undefined : end);
    expect(section).toMatch(/- Source: \S+/);
    expect(section).toMatch(/- Licence: \S+/);
  });
});
