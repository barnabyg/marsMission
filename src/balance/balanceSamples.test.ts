import { describe, expect, it } from "vitest";
import type { TurnSummary } from "../simulation/simulation";
import { sampleProblems } from "./invalidSamples";
import { invalidStates, timelineMissionEventProblems } from "./invalidStates";
import { planningTools, playProgram } from "./playProgram";
import { strategies } from "./strategies";
import { colossusFromTheStart, real, simulationOf, turns } from "./testHelpers";

const simulation = simulationOf(colossusFromTheStart);

/** A rover caching samples at Jezero Crater, with or without the ascent vehicle beside it and the orbiter. */
function cachingRover(withReturn: boolean) {
  return simulation.runTurn(simulation.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: [
        "trailblazer-rover",
        ...(withReturn
          ? ["kestrel-ascent-vehicle", "albatross-return-orbiter"]
          : []),
      ],
      landingSiteId: "jezero-crater",
      assetChoices: { "trailblazer-rover": { activityId: "sample-caching" } },
    },
  }).program;
}

describe("the strategy that caches samples and sends them home", () => {
  const strategy = strategies.find(({ name }) =>
    name.includes("cache samples and send them home"),
  );
  if (!strategy) throw new Error("No strategy sends samples home");

  it("lands an ascent vehicle where samples wait without one, with an Earth return orbiter", () => {
    const program = cachingRover(false);
    const plan = strategy.plan(
      simulation.readProgram(program),
      planningTools(simulation, program),
    );
    expect(plan.mission?.assetIds).toEqual([
      "kestrel-ascent-vehicle",
      "albatross-return-orbiter",
    ]);
    expect(plan.mission?.landingSiteId).toBe("jezero-crater");
  });

  it("sends the samples home on the first Turn it can", () => {
    const program = cachingRover(true);
    const plan = strategy.plan(
      simulation.readProgram(program),
      planningTools(simulation, program),
    );
    expect(plan.bringHome).toBe("samples:jezero-crater");
  });

  it("plays whole Programs without an invalid state, and brings samples home", () => {
    const played = [1, 2, 3, 4, 5].map((seed) =>
      playProgram(real, strategy, seed, turns),
    );
    const home = played
      .flatMap(({ turns: records }) => records)
      .reduce((total, { samplesHome }) => total + samplesHome, 0);
    expect(home).toBeGreaterThan(0);
  });
});

describe("the checks for invalid samples", () => {
  const landed = cachingRover(true);
  const { summary, program } = simulation.runTurn(landed, {
    mission: null,
    bringHome: "samples:jezero-crater",
  });
  const before = simulation.readProgram(landed);
  const after = simulation.readProgram(program);
  const changed = (changes: Partial<TurnSummary>) => ({
    ...summary,
    ...changes,
  });

  it("find nothing wrong with samples cached and sent home", () => {
    expect(summary.samplesHome).toHaveLength(1);
    expect(sampleProblems(before, summary, after)).toEqual([]);
  });

  it.each<[string, () => TurnSummary, RegExp]>([
    [
      "samples cached by an orbiter",
      () =>
        changed({
          samplesCached: summary.samplesCached.map((cached) => ({
            ...cached,
            cachedBy: ["Albatross Orbiter"],
          })),
        }),
      /isn't a rover/,
    ],
    [
      "more samples home than were at the site",
      () =>
        changed({
          samplesHome: summary.samplesHome.map((lot) => ({
            ...lot,
            samples: lot.samples + 1,
            science: lot.science + lot.science / lot.samples,
          })),
        }),
      /other than the samples at their Landing Site/,
    ],
    [
      "samples home with Crew flying home too",
      () =>
        changed({
          journeyHome: {
            crew: ["Amara Okafor"],
            samples: 0,
            samplesFrom: null,
            failure: null,
          },
        }),
      /when Crew flew a journey home too/,
    ],
    [
      "samples home from a failed journey",
      () =>
        changed({
          sampleJourney: {
            siteName: "Jezero Crater",
            samples: summary.samplesHome[0]?.samples ?? 0,
            failure: { missionEventName: "Earth entry", publicSupportLost: 20 },
            stayed: false,
          },
        }),
      /came home from a journey that failed/,
    ],
  ])("catch %s", (_, broken, problem) => {
    expect(sampleProblems(before, broken(), after).join(" ")).toMatch(problem);
  });

  it("catch samples at a site that don't add up", () => {
    const wrong = {
      ...after,
      landingSites: after.landingSites.map((site) =>
        site.id === "jezero-crater"
          ? { ...site, samples: site.samples + 3 }
          : site,
      ),
    };
    expect(sampleProblems(before, summary, wrong).join(" ")).toMatch(
      /aren't what it had/,
    );
  });
});

describe("the checks of a Turn whose samples were lost on the way home", () => {
  const failing = simulationOf({
    ...colossusFromTheStart,
    missionEvents: colossusFromTheStart.missionEvents.map((event) =>
      event.id === "earth-entry" ? { ...event, failureProbability: 1 } : event,
    ),
  });
  const landed = failing.runTurn(failing.startProgram(1), {
    mission: {
      launchVehicleId: "meridian-colossus",
      assetIds: [
        "trailblazer-rover",
        "kestrel-ascent-vehicle",
        "albatross-return-orbiter",
      ],
      landingSiteId: "jezero-crater",
      assetChoices: { "trailblazer-rover": { activityId: "sample-caching" } },
    },
  }).program;
  const { summary, program, timeline } = failing.runTurn(landed, {
    mission: null,
    bringHome: "samples:jezero-crater",
  });
  const before = failing.readProgram(landed);
  const after = failing.readProgram(program);

  it("find nothing wrong, with the Public Support it cost accounted for", () => {
    expect(summary.sampleJourney?.failure?.missionEventName).toBe(
      "Earth entry",
    );
    expect([
      ...invalidStates(before, summary, after),
      ...sampleProblems(before, summary, after),
      ...timelineMissionEventProblems(timeline, summary),
    ]).toEqual([]);
  });
});
