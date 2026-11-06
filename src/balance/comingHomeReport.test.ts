import { describe, expect, it } from "vitest";
import type { CatalogueFiles } from "../catalogue/catalogue";
import { keepsItselfGoingFrom } from "./comingHomeReport";
import type { TurnRecord } from "./playProgram";
import { balanceReport } from "./report";
import type { Strategy } from "./strategy";
import { colossusFromTheStart, files, launchNothing } from "./testHelpers";

/** A Turn that changed nothing, with these changes. */
function turn(changes: Partial<TurnRecord>): TurnRecord {
  return {
    moneyMillions: 0,
    science: 0,
    publicSupport: 100,
    assetsOperating: 0,
    cancelled: false,
    spentMillions: 0,
    thresholdMillions: 0,
    researchGrantMillions: 0,
    thresholdsReached: [],
    researchScience: [],
    benefitScience: 0,
    assetsFailed: 0,
    launched: false,
    missionFailed: false,
    decisionPoints: 0,
    rescues: 0,
    decisions: [],
    developmentsStarted: [],
    developmentsFinished: [],
    unprovenFlights: [],
    crewFlown: 0,
    crewLost: {
      missionEvent: 0,
      health: 0,
      supplies: 0,
      solarParticleEvent: 0,
    },
    crewHome: 0,
    crewHomeBy: { roundTrip: 0, fetched: 0, freeReturn: 0 },
    crewLostOnWayHome: {},
    crewAtMars: 0,
    ascentPropellantKg: 0,
    ascentPropellantUsedKg: 0,
    healthSavedByHabitats: 0,
    grantsAddedByLabsMillions: 0,
    samplesHome: 0,
    sampleScience: 0,
    samplesLost: 0,
    baseFundingMillions: 0,
    ...changes,
  };
}

/** A Turn that launches a Mission costing this much and earns this much in Research Grants. */
const launching = (spent: number, grants: number) =>
  turn({ launched: true, spentMillions: spent, researchGrantMillions: grants });

describe("when a Program keeps itself going", () => {
  it("is from the first Turn after which Research Grants and base funding pay for everything it spends", () => {
    const play = [
      launching(1000, 0),
      launching(1000, 500),
      turn({ researchGrantMillions: 700, baseFundingMillions: 300 }),
      launching(1000, 800),
      turn({ researchGrantMillions: 800 }),
    ];
    // From Turn 3 on, it never needs money it had before: 1000 in, then 1000 out and 800 in, then 800 more.
    expect(keepsItselfGoingFrom(play)).toBe(3);
  });

  it("counts no Funding Threshold, as those run out", () => {
    const play = [
      launching(1000, 0),
      turn({ thresholdMillions: 2000 }),
      launching(1000, 0),
      launching(1000, 0),
    ];
    expect(keepsItselfGoingFrom(play)).toBeNull();
  });

  it("needs three Turns or more to the end, with a Mission launched in them", () => {
    const paying = turn({ researchGrantMillions: 500 });
    expect(keepsItselfGoingFrom([launching(1000, 0), paying, paying])).toBe(
      null,
    );
    expect(
      keepsItselfGoingFrom([launching(1000, 0), launching(100, 500), paying]),
    ).toBeNull();
    expect(
      keepsItselfGoingFrom([
        launching(1000, 0),
        launching(100, 500),
        paying,
        paying,
      ]),
    ).toBe(2);
  });

  it("is never for a cancelled Program", () => {
    const paying = launching(100, 500);
    expect(
      keepsItselfGoingFrom([paying, paying, { ...paying, cancelled: true }]),
    ).toBeNull();
  });
});

describe("the report on coming home", () => {
  /**
   * Flies two Crew to Mars orbit on Turn 1, on a round trip or a Trajectory if asked, fetches them with a return vehicle
   * if asked, and brings them home on the first Turn it can.
   */
  const flyCrew = (choices: {
    roundTrip?: boolean;
    trajectoryId?: string;
    fetch?: boolean;
  }): Strategy => ({
    name: "test: fly Crew",
    description: "Flies two Crew to Mars orbit on the first Turn.",
    plan: (view) => {
      const waiting = view.crew.find(
        ({ withoutWayHome }) => withoutWayHome.length > 0,
      );
      const wayHome = view.crew
        .flatMap(({ waysHome }) => waysHome)
        .find(({ reason }) => reason === null)?.key;
      const mission =
        view.turnNumber === 1
          ? {
              launchVehicleId: "meridian-colossus",
              assetIds: [],
              crew: {
                size: 2,
                // So that they live long enough to be fetched and get home.
                protectionId: "protection-heavy-shielding",
                suppliesId: "supplies-ample",
                ...(choices.roundTrip ? { roundTrip: true } : {}),
              },
              ...(choices.trajectoryId
                ? { trajectoryId: choices.trajectoryId }
                : {}),
            }
          : choices.fetch && waiting
            ? {
                launchVehicleId: "meridian-colossus",
                assetIds: [],
                returnVehicle: { forCrewAt: waiting.key },
              }
            : null;
      return { mission, ...(wayHome ? { bringHome: wayHome } : {}) };
    },
  });
  /** As colossusFromTheStart, with this Mission Event always failing. */
  const failing = (eventId: string): CatalogueFiles => ({
    ...colossusFromTheStart,
    missionEvents: colossusFromTheStart.missionEvents.map((event) => ({
      ...event,
      failureProbability: event.id === eventId ? 1 : 0,
    })),
  });
  /** The section's header and the cells after the strategy's name in its row of Crew and samples home. */
  const homeRow = (text: string) => {
    const lines = text.slice(text.indexOf("== Coming Home ==")).split("\n");
    const header = lines.find((line) => line.startsWith("Strategy "));
    const row = lines.find((line) => /^test: fly Crew +\d/.test(line));
    const cells = row?.replace("test: fly Crew", "").trim().split(/\s+/);
    return Object.fromEntries(
      (header?.trim().split(/\s+/).slice(1) ?? []).map((name, index) => [
        name,
        cells?.[index],
      ]),
    );
  };

  it("counts Crew home after a round trip, after a return vehicle fetched them and on a Free-return", () => {
    expect(
      homeRow(
        balanceReport(colossusFromTheStart, 2, [flyCrew({ roundTrip: true })]),
      ),
    ).toMatchObject({ RoundTrip: "2.0", Fetched: "0.0", FreeReturn: "0.0" });
    expect(
      homeRow(
        balanceReport(colossusFromTheStart, 2, [flyCrew({ fetch: true })]),
      ),
    ).toMatchObject({ RoundTrip: "0.0", Fetched: "2.0", FreeReturn: "0.0" });
    expect(
      homeRow(
        balanceReport(failing("mars-orbit-insertion"), 2, [
          flyCrew({ trajectoryId: "free-return" }),
        ]),
      ),
    ).toMatchObject({ RoundTrip: "0.0", Fetched: "0.0", FreeReturn: "2.0" });
  });

  it("counts Crew lost on their journey home by the Mission Event that failed", () => {
    expect(
      homeRow(
        balanceReport(failing("earth-entry"), 2, [
          flyCrew({ roundTrip: true }),
        ]),
      ),
    ).toMatchObject({ RoundTrip: "0.0", "Lost:Earthentry": "2.0" });
  });

  it("says when nothing came home, and how many Programs keep themselves going, and from when", () => {
    const text = balanceReport(files, 3, [launchNothing]);
    expect(text).toContain("Coming home: nothing came home");
    expect(text).toMatch(/^test: launch nothing +0\.0 +- +-$/m);
  });
});
