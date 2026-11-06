import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../../simulation/simulation";
import { realCatalogueFiles } from "../../testing/realCatalogue";
import {
  eventCardFor,
  missionEventPicture,
  missionEventPictures,
} from "./eventCard";

const base = { day: 3, title: "Title", description: "Description" };

describe("the events column's cards", () => {
  it("has a picture of its own for every Mission Event in the data files", () => {
    const ids = (realCatalogueFiles().missionEvents as { id: string }[]).map(
      ({ id }) => id,
    );
    expect(ids.filter((id) => !(id in missionEventPictures))).toEqual([]);
  });

  it("gives the journey home's Mission Events pictures of their own", () => {
    expect(
      [
        "mars-ascent",
        "mars-orbit-rendezvous",
        "trans-earth-injection",
        "earth-entry",
      ].map(missionEventPicture),
    ).toEqual([
      "marsAscent",
      "marsOrbitRendezvous",
      "transEarthInjection",
      "earthEntry",
    ]);
  });

  it("shows a plain spacecraft for a Mission Event with no picture of its own", () => {
    expect(missionEventPicture("aerobraking")).toBe("spacecraft");
  });

  it("marks a failed Mission Event as a failure, with the same picture as its success", () => {
    const entry = (outcome: "success" | "failure"): TimelineEntry => ({
      ...base,
      kind: "missionEvent",
      eventId: "entry-descent-landing",
      outcome,
    });
    expect(eventCardFor(entry("success"))).toEqual({
      picture: "entryDescentLanding",
      tag: "Mission Event",
      icon: "rocket",
      failed: false,
    });
    expect(eventCardFor(entry("failure"))).toMatchObject({
      picture: "entryDescentLanding",
      failed: true,
    });
  });

  it("shows a Hazard's own picture, and a Decision Point the picture of what it is about", () => {
    expect(
      eventCardFor({ ...base, kind: "hazard", hazard: "dustStorm" }),
    ).toMatchObject({ picture: "dustStorm", tag: "Hazard", failed: false });
    expect(
      eventCardFor({
        ...base,
        kind: "decisionPoint",
        hazard: "solarParticleEvent",
      }),
    ).toMatchObject({
      picture: "solarParticleEvent",
      tag: "Decision Point",
      failed: true,
    });
    expect(
      eventCardFor({
        ...base,
        kind: "decisionPoint",
        eventId: "mars-orbit-insertion",
      }),
    ).toMatchObject({ picture: "orbitInsertion" });
    expect(eventCardFor({ ...base, kind: "decisionPoint" })).toMatchObject({
      picture: "spacecraft",
    });
  });

  it.each([
    ["assetFailed", "assetFailed", true],
    ["crewLost", "crewLost", true],
    ["suppliesOut", "suppliesOut", true],
    ["assetEnded", "assetEnded", false],
    ["crewArrived", "crewArrived", false],
    ["milestone", "milestone", false],
    ["fundingThreshold", "fundingThreshold", false],
    ["firstLanding", "firstLanding", false],
    ["survey", "survey", false],
    ["flightProven", "flightProven", false],
    ["missionReturned", "missionReturned", false],
    ["crewHome", "crewHome", false],
    ["samples", "samples", false],
    ["returnVehicleArrived", "returnVehicleArrived", false],
  ] as const)("shows a %s entry as %s, failed: %s", (kind, picture, failed) => {
    const entry = { ...base, kind, milestoneId: "m" } as TimelineEntry;
    expect(eventCardFor(entry)).toMatchObject({ picture, failed });
  });
});
