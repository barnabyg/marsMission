import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import {
  createSimulation,
  type Timeline,
  type TurnPlan,
} from "../simulation/simulation";
import { calmCatalogueFiles } from "../testing/realCatalogue";
import { orbitersOn } from "./marsOrbit/marsOrbit";
import { currentView, startingChoice, viewWithSites } from "./missionViews";
import { soundFor } from "./sounds";
import { refuellingOf } from "./spacecraft/refuelling";
import { assetsOnBoard, onBoardLabelClass } from "./spacecraft/spacecraft";
import { crewOutsideAt } from "./surface/crewAtSite";
import {
  landingSequenceOf,
  sequenceKind,
  sequenceMs,
  sitesDuring,
  touchdownMs,
  type LandingSequence,
} from "./surface/sequence";
import { sitesToShow } from "./surface/surface";

/**
 * Which view and sequence each Crew event leads Mission Mode to, from real Turns: the real data files with the Meridian
 * Colossus built, money enough for several Crewed Missions, and the named Mission Event certain to fail.
 */
function simulationWhere(
  failing: string | null,
  changes: (files: CatalogueFiles) => CatalogueFiles = (files) => files,
) {
  const files = calmCatalogueFiles();
  return createSimulation(
    parseCatalogue(
      changes({
        ...files,
        program: { ...files.program, startingMoneyMillions: 50_000 },
        launchVehicles: files.launchVehicles.map((vehicle) =>
          vehicle.id === "meridian-colossus"
            ? {
                ...vehicle,
                technologyReadiness: "built" as const,
                development: undefined,
              }
            : vehicle,
        ),
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: event.id === failing ? 1 : 0,
        })),
      }),
    ),
  );
}

const crew = { size: 2, suppliesId: "supplies-ample" };
const toOrbit: TurnPlan = {
  mission: { launchVehicleId: "meridian-colossus", assetIds: [], crew },
};
const toLand: TurnPlan = {
  mission: {
    launchVehicleId: "meridian-colossus",
    assetIds: [],
    crew: { ...crew, landsAtSite: true },
    landingSiteId: "jezero-crater",
  },
};

function firstTurn(failing: string | null, plan: TurnPlan) {
  const simulation = simulationWhere(failing);
  return simulation.runTurn(simulation.startProgram(1), plan).timeline;
}

/** The view showing once every entry up to and including the first that matches has happened, with no choice made. */
function viewAt(timeline: Timeline, matches: (index: number) => boolean) {
  const index = timeline.entries.findIndex((_, at) => matches(at));
  expect(index).toBeGreaterThanOrEqual(0);
  return currentView(timeline.entries, index + 1, startingChoice);
}

function entryWith(timeline: Timeline, eventId: string) {
  return (index: number) => {
    const entry = timeline.entries[index];
    return entry?.kind === "missionEvent" && entry.eventId === eventId;
  };
}

function sequenceOf(timeline: Timeline): LandingSequence {
  const sequence = landingSequenceOf(timeline);
  if (!sequence) throw new Error("Expected a landing sequence");
  return sequence;
}

describe("a Crew landing in Mission Mode", () => {
  const timeline = firstTurn(null, toLand);
  const sequence = sequenceOf(timeline);

  it("moves to the surface view, to play a Crew landing of its own", () => {
    expect(viewAt(timeline, entryWith(timeline, "entry-descent-landing"))).toBe(
      "surface",
    );
    expect(sequenceKind(sequence)).toBe("crew-landing");
    expect(sequence).toMatchObject({
      siteName: "Jezero Crater",
      assets: [{ name: "Odyssey", model: "crewLander", place: 0, lander: 0 }],
    });
  });

  it("keeps the Crew aboard as they come down, then shows them at work outside", () => {
    const { day } = sequence;
    const at = (elapsedMs: number) =>
      crewOutsideAt(timeline, day, "Jezero Crater", { sequence, elapsedMs });
    expect(at(touchdownMs - 100)).toEqual([]);
    expect(at(sequenceMs)).toEqual(["Amara Okafor", "Lena Petrova"]);
    expect(
      crewOutsideAt(timeline, timeline.durationDays - 1, "Jezero Crater", null),
    ).toHaveLength(2);
  });

  it("has the Crew's ship ringed on its way, and a model of its own on board", () => {
    const onBoard = assetsOnBoard(timeline.mission, 100);
    expect(onBoard).toEqual([{ name: "Odyssey", kind: "crew", lost: false }]);
    expect(onBoardLabelClass("crew", false)).toBe("crew-label");
  });

  it("shows the Crew's ship in Earth orbit for its Tanker launch and Rendezvous, which the spacecraft view plays", () => {
    const refuelling = refuellingOf(timeline.entries);
    expect(refuelling?.rendezvous?.failed).toBe(false);
    expect(viewAt(timeline, entryWith(timeline, "rendezvous"))).toBe(
      "spacecraft",
    );
  });

  it("brings a second Crew down beside the first, in their place, which they join", () => {
    const simulation = simulationWhere(null);
    const first = simulation.runTurn(simulation.startProgram(1), toLand);
    const second = simulation.runTurn(first.program, toLand).timeline;
    expect(sequenceOf(second).assets).toEqual([
      { name: "Odyssey", model: "crewLander", place: 0, lander: 1 },
    ]);
    const landed = sequenceOf(second).day;
    expect(
      crewOutsideAt(second, landed, "Jezero Crater", {
        sequence: sequenceOf(second),
        elapsedMs: touchdownMs - 100,
      }),
    ).toEqual(["Amara Okafor", "Lena Petrova"]);
    expect(crewOutsideAt(second, landed + 1, "Jezero Crater", null)).toEqual([
      "Amara Okafor",
      "Lena Petrova",
      "Kenji Sato",
      "Diego Morales",
    ]);
  });
});

describe("a Crew crash in Mission Mode", () => {
  const timeline = firstTurn("entry-descent-landing", toLand);
  const sequence = sequenceOf(timeline);

  it("moves to the surface view, to play a Crew crash of its own", () => {
    expect(viewAt(timeline, entryWith(timeline, "entry-descent-landing"))).toBe(
      "surface",
    );
    expect(sequenceKind(sequence)).toBe("crew-crash");
  });

  it("shows no Crew at the site, which the view leaves for Mars orbit once the crash has played", () => {
    const { day } = sequence;
    expect(crewOutsideAt(timeline, day, "Jezero Crater", null)).toEqual([]);
    const sites = (elapsedMs: number) =>
      sitesDuring(sitesToShow(timeline, day), { sequence, elapsedMs });
    expect(sites(1000)).toEqual(["Jezero Crater"]);
    expect(viewWithSites("surface", sites(sequenceMs))).toBe("marsOrbit");
  });

  it("plays the sound for losing Crew", () => {
    const lost = timeline.entries.find(({ kind }) => kind === "crewLost");
    expect(lost && soundFor(lost)).toBe("crewLost");
  });
});

describe("Crew to Mars orbit in Mission Mode", () => {
  it("moves to Mars orbit as they arrive, and shows their ship there from then", () => {
    const timeline = firstTurn(null, toOrbit);
    const arrival = timeline.entries.find(
      (entry) =>
        entry.kind === "missionEvent" &&
        entry.eventId === "mars-orbit-insertion",
    );
    expect(viewAt(timeline, entryWith(timeline, "mars-orbit-insertion"))).toBe(
      "marsOrbit",
    );
    const day = arrival?.day ?? 0;
    expect(orbitersOn(timeline, day - 1)).toEqual([]);
    expect(orbitersOn(timeline, day)).toEqual([
      { name: "Odyssey", kind: "crew", slot: 0 },
    ]);
  });
});

describe("a solar particle event with Crew aboard in Mission Mode", () => {
  const simulation = simulationWhere(null, (files) => ({
    ...files,
    hazards: {
      ...files.hazards,
      solarParticleEvent: {
        ...files.hazards.solarParticleEvent,
        chancePerDayInFlight: 0.004,
      },
    },
  }));
  /** The first seed whose Mission meets one on the way. */
  function meetingOne() {
    for (let seed = 1; seed < 1000; seed++) {
      const progress = simulation.workOutTurn(
        simulation.startProgram(seed),
        toOrbit,
      );
      if (progress.decisionPoint) return progress;
    }
    throw new Error("No seed meets a solar particle event");
  }
  const { decisionPoint, timeline } = meetingOne();

  it("moves to the spacecraft view, which shows the Crew's ship on board", () => {
    expect(decisionPoint.kind).toBe("solarParticleEvent");
    expect(decisionPoint.assets).toContain("Amara Okafor");
    const index = timeline.entries.findIndex(
      ({ kind }) => kind === "decisionPoint",
    );
    expect(viewAt(timeline, (at) => at === index)).toBe("spacecraft");
    const day = timeline.entries[index]?.day ?? 0;
    expect(assetsOnBoard(timeline.mission, day)).toEqual([
      { name: "Odyssey", kind: "crew", lost: false },
    ]);
  });
});
