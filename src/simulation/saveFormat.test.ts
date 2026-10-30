import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../catalogue/catalogue";
import {
  createSimulation,
  SaveError,
  type Program,
  type Simulation,
} from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendOrbiter, setup } from "./testHelpers";

describe("saving and restoring a Program", () => {
  /** A save as it comes back from storage, which only holds text. */
  function throughStorage(simulation: Simulation, program: Program): unknown {
    return JSON.parse(JSON.stringify(simulation.saveProgram(program)));
  }

  function risky() {
    const files = testCatalogueFiles();
    return createSimulation(
      parseCatalogue({
        ...files,
        missionEvents: files.missionEvents.map((event) => ({
          ...event,
          failureProbability: 0.4,
        })),
      }),
    );
  }

  it("carries a format version from the first release", () => {
    const { simulation, program } = setup();
    expect(simulation.saveProgram(program).formatVersion).toBe(1);
  });

  it("restores a save made by the first release, whatever later versions do", () => {
    const { simulation } = setup();
    // A literal copy of what format 1 looks like. Don't change this: it's a compatibility contract.
    const firstRelease = {
      formatVersion: 1,
      program: {
        seed: 42,
        turnNumber: 3,
        date: "2033-03-10",
        moneyMillions: 1250,
        publicSupport: 180,
        science: 100,
        milestoneIds: ["first-orbiter"],
        fundingThresholdsPaid: [300],
        operatingAssets: [
          {
            assetId: "test-orbiter",
            name: "Test Orbiter",
            kind: "orbiter",
            arrivedOn: "2029-06-19",
          },
        ],
        status: { kind: "active" },
      },
    };
    const view = simulation.readProgram(
      simulation.restoreProgram(firstRelease),
    );
    expect(view).toMatchObject({
      turnNumber: 3,
      date: "2033-03-10",
      moneyMillions: 1250,
      publicSupport: 180,
      science: 100,
    });
  });

  it("restores exactly the Program that was saved", () => {
    const { simulation, program } = setup();
    const { program: flown } = simulation.runTurn(program, sendOrbiter);
    expect(
      simulation.restoreProgram(throughStorage(simulation, flown)),
    ).toEqual(flown);
  });

  it("plays on exactly as if it was never saved, including its seed", () => {
    const simulation = risky();
    for (let seed = 1; seed <= 50; seed++) {
      const start = simulation.startProgram(seed);
      const unsaved = simulation.runTurn(start, sendOrbiter);
      const restored = simulation.restoreProgram(
        throughStorage(simulation, start),
      );
      expect(simulation.runTurn(restored, sendOrbiter)).toEqual(unsaved);
    }
  });

  it.each([
    ["isn't a save at all", "hello"],
    ["is empty", null],
    ["has no format version", { program: {} }],
    ["has a format version that isn't a number", { formatVersion: "one" }],
  ])("reports a save that %s as corrupt", (_, saved) => {
    const { simulation } = setup();
    expect(() => simulation.restoreProgram(saved)).toThrow(SaveError);
    expect(() => simulation.restoreProgram(saved)).toThrow(/corrupt/);
  });

  it("reports a save with damaged contents as corrupt", () => {
    const { simulation, program } = setup();
    const saved = simulation.saveProgram(program);
    expect(() =>
      simulation.restoreProgram({
        ...saved,
        program: { ...saved.program, moneyMillions: "lots" },
      }),
    ).toThrow(/corrupt/);
  });

  it("names the unknown format version of a save it can't read", () => {
    const { simulation, program } = setup();
    const saved = { ...simulation.saveProgram(program), formatVersion: 99 };
    expect(() => simulation.restoreProgram(saved)).toThrow(SaveError);
    expect(() => simulation.restoreProgram(saved)).toThrow(/format 99/);
  });

  it("names the format version even when a future format has a different shape", () => {
    const { simulation } = setup();
    expect(() => simulation.restoreProgram({ formatVersion: 2 })).toThrow(
      /format 2/,
    );
  });

  it("refuses to continue a Program that has ended", () => {
    const { simulation, program } = setup();
    const saved = simulation.saveProgram(simulation.retireProgram(program));
    expect(() => simulation.restoreProgram(saved)).toThrow(SaveError);
    expect(() => simulation.restoreProgram(saved)).toThrow(/has ended/);
  });
});
