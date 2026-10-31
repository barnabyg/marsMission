import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  missionViews,
  startingChoice,
  viewAskedForBy,
  viewName,
  viewWithSites,
  type ViewChoice,
} from "./missionViews";

function missionEvent(
  eventId: string,
  outcome: "success" | "failure" = "success",
): TimelineEntry {
  return {
    kind: "missionEvent",
    day: 1,
    eventId,
    title: eventId,
    description: "",
    outcome,
  };
}

const milestone: TimelineEntry = {
  kind: "milestone",
  day: 1,
  milestoneId: "first-orbiter",
  title: "First orbiter",
  description: "",
};

describe("Mission Mode's views", () => {
  it("offers the solar system first, because every Turn starts there", () => {
    expect(missionViews.map(({ id }) => id)).toEqual([
      "solarSystem",
      "marsOrbit",
      "surface",
    ]);
    expect(startingChoice.view).toBe("solarSystem");
  });

  it("names each view for the player", () => {
    expect(viewName("solarSystem")).toBe("Solar system");
    expect(viewName("marsOrbit")).toBe("Mars orbit");
    expect(viewName("surface")).toBe("Surface");
  });
});

describe("which view a timeline entry asks for", () => {
  it.each(["mars-orbit-insertion", "entry-descent-landing"])(
    "asks for Mars orbit at %s, whether it succeeds or fails",
    (eventId) => {
      expect(viewAskedForBy(missionEvent(eventId))).toBe("marsOrbit");
      expect(viewAskedForBy(missionEvent(eventId, "failure"))).toBe(
        "marsOrbit",
      );
    },
  );

  it.each(["launch", "mars-transfer-burn"])(
    "asks for nothing at %s, whether it succeeds or fails",
    (eventId) => {
      expect(viewAskedForBy(missionEvent(eventId))).toBeNull();
      expect(viewAskedForBy(missionEvent(eventId, "failure"))).toBeNull();
    },
  );

  it("asks for nothing at anything that isn't a Mission Event", () => {
    expect(viewAskedForBy(milestone)).toBeNull();
  });
});

describe("the surface view with no Landing Site left to show", () => {
  it("hands over to Mars orbit", () => {
    expect(viewWithSites("surface", [])).toBe("marsOrbit");
  });

  it("stays on the surface while there is a site", () => {
    expect(viewWithSites("surface", ["Alpha Plain"])).toBe("surface");
  });

  it("leaves the other views alone", () => {
    expect(viewWithSites("solarSystem", [])).toBe("solarSystem");
    expect(viewWithSites("marsOrbit", [])).toBe("marsOrbit");
  });
});

describe("the view showing at any moment", () => {
  const entries = [
    missionEvent("launch"),
    missionEvent("mars-transfer-burn"),
    missionEvent("mars-orbit-insertion"),
    milestone,
    missionEvent("entry-descent-landing"),
    milestone,
  ];

  it("starts on the solar system and stays there on the way to Mars", () => {
    expect(currentView(entries, 0, startingChoice)).toBe("solarSystem");
    expect(currentView(entries, 2, startingChoice)).toBe("solarSystem");
  });

  it("moves when an entry with a view of its own happens", () => {
    expect(currentView(entries, 3, startingChoice)).toBe("marsOrbit");
    expect(currentView(entries, 4, startingChoice)).toBe("marsOrbit");
  });

  it("holds the player's switch until the next entry with a view of its own", () => {
    const switchedBack: ViewChoice = {
      view: "solarSystem",
      entriesHappened: 3,
    };
    expect(currentView(entries, 3, switchedBack)).toBe("solarSystem");
    expect(currentView(entries, 4, switchedBack)).toBe("solarSystem");
    expect(currentView(entries, 5, switchedBack)).toBe("marsOrbit");
  });

  it("holds a switch made after the last such entry to the end of the Turn", () => {
    const switchedBack: ViewChoice = {
      view: "solarSystem",
      entriesHappened: 5,
    };
    expect(currentView(entries, 6, switchedBack)).toBe("solarSystem");
  });

  it("lets the player go to a view before any entry asks for it", () => {
    const switched: ViewChoice = { view: "marsOrbit", entriesHappened: 1 };
    expect(currentView(entries, 2, switched)).toBe("marsOrbit");
  });

  it("depends only on how many entries have happened, so several in one frame give the same view", () => {
    const stepByStep = [1, 2, 3, 4, 5, 6].map((happened) =>
      currentView(entries, happened, startingChoice),
    );
    expect(stepByStep.at(-1)).toBe(currentView(entries, 6, startingChoice));
  });
});
