import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  landingSitePick,
  missionViews,
  startingChoice,
  viewAskedForBy,
  viewName,
  viewWithSites,
  viewWithSpacecraft,
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

function decisionPoint(
  about: Pick<
    Extract<TimelineEntry, { kind: "decisionPoint" }>,
    "eventId" | "hazard" | "siteName"
  >,
): TimelineEntry {
  return {
    kind: "decisionPoint",
    day: 1,
    title: "Decision Point",
    description: "",
    ...about,
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
      "spacecraft",
    ]);
    expect(startingChoice.view).toBe("solarSystem");
  });

  it("names each view for the player", () => {
    expect(viewName("solarSystem")).toBe("Solar system");
    expect(viewName("marsOrbit")).toBe("Mars orbit");
    expect(viewName("surface")).toBe("Surface");
    expect(viewName("spacecraft")).toBe("Spacecraft");
  });
});

describe("which view a timeline entry asks for", () => {
  it("asks for Mars orbit at orbit insertion, whether it succeeds or fails", () => {
    const eventId = "mars-orbit-insertion";
    expect(viewAskedForBy(missionEvent(eventId))).toBe("marsOrbit");
    expect(viewAskedForBy(missionEvent(eventId, "failure"))).toBe("marsOrbit");
  });

  it("asks for the surface at entry/descent/landing, whether it succeeds or fails", () => {
    const eventId = "entry-descent-landing";
    expect(viewAskedForBy(missionEvent(eventId))).toBe("surface");
    expect(viewAskedForBy(missionEvent(eventId, "failure"))).toBe("surface");
  });

  it("asks for nothing at launch, whether it succeeds or fails", () => {
    expect(viewAskedForBy(missionEvent("launch"))).toBeNull();
    expect(viewAskedForBy(missionEvent("launch", "failure"))).toBeNull();
  });

  it("asks for the spacecraft when the transfer burn fails, and for nothing when it works", () => {
    const eventId = "mars-transfer-burn";
    expect(viewAskedForBy(missionEvent(eventId))).toBeNull();
    expect(viewAskedForBy(missionEvent(eventId, "failure"))).toBe("spacecraft");
  });

  it("asks for the solar system when a failure swings the Mission back to Earth", () => {
    expect(
      viewAskedForBy({
        kind: "missionEvent",
        day: 210,
        eventId: "mars-orbit-insertion",
        title: "Mars orbit insertion failed",
        description: "",
        outcome: "failure",
        returningToEarth: true,
      }),
    ).toBe("solarSystem");
  });

  it("asks for the spacecraft at a Decision Point on the transfer burn", () => {
    expect(
      viewAskedForBy(decisionPoint({ eventId: "mars-transfer-burn" })),
    ).toBe("spacecraft");
  });

  it("leaves a Decision Point on a later Mission Event to the entry that follows it", () => {
    expect(
      viewAskedForBy(decisionPoint({ eventId: "mars-orbit-insertion" })),
    ).toBeNull();
  });

  it("asks for the spacecraft at a solar particle event, and for the surface at a dust storm", () => {
    expect(
      viewAskedForBy(decisionPoint({ hazard: "solarParticleEvent" })),
    ).toBe("spacecraft");
    expect(
      viewAskedForBy(
        decisionPoint({ hazard: "dustStorm", siteName: "Alpha Plain" }),
      ),
    ).toBe("surface");
  });

  it("leaves how a solar particle event came out to its Decision Point", () => {
    expect(
      viewAskedForBy({
        kind: "hazard",
        hazard: "solarParticleEvent",
        day: 1,
        title: "Solar particle event: safe mode",
        description: "",
      }),
    ).toBeNull();
  });

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

describe("the spacecraft view with nothing left to show", () => {
  it("hands over to where it's told", () => {
    expect(viewWithSpacecraft("spacecraft", "marsOrbit")).toBe("marsOrbit");
    expect(viewWithSpacecraft("spacecraft", "solarSystem")).toBe("solarSystem");
  });

  it("stays while it has something to show", () => {
    expect(viewWithSpacecraft("spacecraft", null)).toBe("spacecraft");
  });

  it("leaves the other views alone", () => {
    expect(viewWithSpacecraft("surface", "marsOrbit")).toBe("surface");
    expect(viewWithSpacecraft("solarSystem", "marsOrbit")).toBe("solarSystem");
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
    expect(currentView(entries, 5, startingChoice)).toBe("surface");
  });

  it("holds the player's switch until the next entry with a view of its own", () => {
    const switchedBack: ViewChoice = {
      view: "solarSystem",
      entriesHappened: 3,
    };
    expect(currentView(entries, 3, switchedBack)).toBe("solarSystem");
    expect(currentView(entries, 4, switchedBack)).toBe("solarSystem");
    expect(currentView(entries, 5, switchedBack)).toBe("surface");
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

  it("doesn't pull the player back after they switch away from a landing", () => {
    const switchedAway: ViewChoice = { view: "marsOrbit", entriesHappened: 5 };
    expect(currentView(entries, 5, switchedAway)).toBe("marsOrbit");
    expect(currentView(entries, 6, switchedAway)).toBe("marsOrbit");
  });

  it("moves to the spacecraft for a failed transfer burn, and holds a later switch", () => {
    const failing = [
      missionEvent("launch"),
      missionEvent("mars-transfer-burn", "failure"),
      milestone,
    ];
    expect(currentView(failing, 1, startingChoice)).toBe("solarSystem");
    expect(currentView(failing, 2, startingChoice)).toBe("spacecraft");
    const switchedAway: ViewChoice = {
      view: "solarSystem",
      entriesHappened: 2,
    };
    expect(currentView(failing, 3, switchedAway)).toBe("solarSystem");
  });

  it("depends only on how many entries have happened, so several in one frame give the same view", () => {
    const stepByStep = [1, 2, 3, 4, 5, 6].map((happened) =>
      currentView(entries, happened, startingChoice),
    );
    expect(stepByStep.at(-1)).toBe(currentView(entries, 6, startingChoice));
  });
});

describe("the player's pick of Landing Site", () => {
  const entries = [
    missionEvent("launch"),
    missionEvent("entry-descent-landing"),
    milestone,
  ];

  it("holds as other entries pass", () => {
    const pick = { siteName: "Alpha Plain", entriesHappened: 0 };
    expect(landingSitePick(entries, 1, pick)).toBe("Alpha Plain");
  });

  it.each(["success", "failure"] as const)(
    "gives way when a landing happens, so that the camera shows it, on a %s",
    (outcome) => {
      const pick = { siteName: "Alpha Plain", entriesHappened: 1 };
      const landing = [
        missionEvent("launch"),
        missionEvent("entry-descent-landing", outcome),
      ];
      expect(landingSitePick(landing, 2, pick)).toBeNull();
    },
  );

  it("holds if the player picks during the landing, so that they aren't pulled back", () => {
    const pick = { siteName: "Alpha Plain", entriesHappened: 2 };
    expect(landingSitePick(entries, 2, pick)).toBe("Alpha Plain");
    expect(landingSitePick(entries, 3, pick)).toBe("Alpha Plain");
  });

  it("is nothing until one is made", () => {
    expect(
      landingSitePick(entries, 3, { siteName: null, entriesHappened: 0 }),
    ).toBeNull();
  });
});
