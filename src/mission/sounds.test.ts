import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";
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

  it("plays the launch sound for a tanker launch, and a sound of its own for a rendezvous", () => {
    expect(soundFor(missionEvent("tanker-launch", "success"))).toBe("launch");
    expect(soundFor(missionEvent("rendezvous", "success"))).toBe("rendezvous");
    expect(soundFor(missionEvent("rendezvous", "failure"))).toBe("failure");
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

  it("plays a sound of its own when Crew are lost, whatever the cause", () => {
    expect(
      soundFor({
        kind: "crewLost",
        day: 0,
        title: "Crew lost",
        description: "",
      }),
    ).toBe("crewLost");
  });

  it("plays a sound of its own when Crew come home safe, and the launch sound as Mars ascent lifts off", () => {
    expect(
      soundFor({
        kind: "crewHome",
        day: 270,
        title: "Crew home",
        description: "",
      }),
    ).toBe("crewHome");
    expect(soundFor(missionEvent("mars-ascent", "success"))).toBe("launch");
  });

  it("leaves any other entry silent", () => {
    expect(soundFor(missionEvent("mars-transfer-burn", "success"))).toBeNull();
  });

  it("matches each success sound to a Mission Event that exists in the real data files", () => {
    const { missionEvents } = realCatalogueFiles();
    const sounds = missionEvents.map(({ id }) =>
      soundFor(missionEvent(id, "success")),
    );
    expect(sounds.filter((sound) => sound === "launch")).toHaveLength(3);
    expect(sounds).toContain("rendezvous");
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
