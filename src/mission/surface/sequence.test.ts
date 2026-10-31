import { describe, expect, it } from "vitest";
import { parseCatalogue } from "../../catalogue/catalogue";
import {
  createSimulation,
  type AssetAtMars,
  type Timeline,
  type TimelineEntry,
} from "../../simulation/simulation";
import { realCatalogueFiles } from "../../testing/realCatalogue";
import { viewWithSites } from "../missionViews";
import { siteShown } from "./surface";
import {
  fallAt,
  hasImpacted,
  landingSequenceOf,
  sequenceMs,
  sequenceNow,
  sequenceRunning,
  sequenceStatus,
  sitesDuring,
} from "./sequence";

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];
type MissionEventEntry = Extract<TimelineEntry, { kind: "missionEvent" }>;
type Shown = Pick<Timeline, "assetsAtMars" | "mission" | "entries">;

const missionAsset = (overrides: Partial<MissionAsset>): MissionAsset => ({
  name: "Prospector",
  kind: "lander",
  landingSiteName: "Alpha Plain",
  deliveredOnDay: 205,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

const crashed = (overrides: Partial<MissionAsset> = {}) =>
  missionAsset({
    deliveredOnDay: null,
    lostOnDay: 205,
    crashed: true,
    ...overrides,
  });

const atMars = (overrides: Partial<AssetAtMars>): AssetAtMars => ({
  key: "prospector:2030",
  name: "Prospector",
  kind: "lander",
  landingSiteName: "Alpha Plain",
  activityName: "Nothing",
  surfaceMotion: "still",
  arrivedOnDay: 205,
  fromDay: 205,
  untilDay: null,
  ...overrides,
});

const landingEntry = (
  outcome: "success" | "failure",
  day = 205,
): MissionEventEntry => ({
  kind: "missionEvent",
  day,
  eventId: "entry-descent-landing",
  title: "Entry/descent/landing",
  description: "",
  outcome,
});

const launchEntry: MissionEventEntry = {
  ...landingEntry("success", 0),
  eventId: "launch",
};

function shown(
  assets: MissionAsset[],
  assetsAtMars: AssetAtMars[],
  entries: MissionEventEntry[],
): Shown {
  return {
    assetsAtMars,
    entries,
    mission: {
      launchDay: 0,
      arrivalDay: 200,
      launchVehicleName: "Test Vehicle",
      assetNames: assets.map(({ name }) => name),
      assets,
      failedOnDay: null,
    },
  };
}

const landed = shown(
  [missionAsset({})],
  [atMars({})],
  [launchEntry, landingEntry("success")],
);
const crash = shown([crashed()], [], [launchEntry, landingEntry("failure")]);

function sequenceOf(timeline: Shown) {
  const sequence = landingSequenceOf(timeline);
  if (!sequence) throw new Error("Expected a landing sequence");
  return sequence;
}

/** How playback looks when the landing, the second entry, happened this many ms ago. */
const played = (elapsedMs: number) => ({
  playedMs: 1000 + elapsedMs,
  entriesPlayedMs: [0, 1000],
});
const beforeLanding = { playedMs: 900, entriesPlayedMs: [0] };

describe("the landing sequence a Timeline has", () => {
  it("is none in a Turn with no Mission", () => {
    expect(
      landingSequenceOf({ mission: null, assetsAtMars: [], entries: [] }),
    ).toBeNull();
  });

  it("is none for a Mission that doesn't land", () => {
    const orbiter = missionAsset({ landingSiteName: null, kind: "orbiter" });
    expect(landingSequenceOf(shown([orbiter], [], [launchEntry]))).toBeNull();
  });

  it("is none when something else was lost before the landing, which then never happens", () => {
    const orbiter = missionAsset({
      name: "Pathfinder",
      kind: "orbiter",
      landingSiteName: null,
      deliveredOnDay: null,
      lostOnDay: 200,
    });
    const lander = missionAsset({ deliveredOnDay: null, lostOnDay: 200 });
    const insertionFailed: MissionEventEntry = {
      ...landingEntry("failure", 200),
      eventId: "mars-orbit-insertion",
    };
    expect(
      landingSequenceOf(
        shown([orbiter, lander], [], [launchEntry, insertionFailed]),
      ),
    ).toBeNull();
  });

  it("is a landing for a success, at the site and on the day of its entry", () => {
    expect(sequenceOf(landed)).toMatchObject({
      siteName: "Alpha Plain",
      day: 205,
      crashed: false,
      assets: [{ name: "Prospector", model: "lander", place: 0 }],
    });
  });

  it("is a crash for a failure, at the site and on the day of its entry", () => {
    expect(sequenceOf(crash)).toMatchObject({
      siteName: "Alpha Plain",
      day: 205,
      crashed: true,
      assets: [{ name: "Prospector", model: "lander" }],
    });
  });

  it("shows the Assets actually bought", () => {
    const rover = { name: "Trailblazer", kind: "rover" };
    const models = (assets: MissionAsset[]) =>
      sequenceOf(shown(assets, [], [landingEntry("failure")])).assets.map(
        ({ name, model }) => [name, model],
      );
    expect(models([crashed(rover)])).toEqual([["Trailblazer", "rover"]]);
    expect(models([crashed(), crashed(rover)])).toEqual([
      ["Prospector", "lander"],
      ["Trailblazer", "rover"],
    ]);
  });

  it("leaves out an orbiter that is safe when the lander crashes", () => {
    const orbiter = missionAsset({
      name: "Pathfinder",
      kind: "orbiter",
      landingSiteName: null,
      deliveredOnDay: 200,
    });
    const timeline = shown(
      [orbiter, crashed()],
      [atMars({ name: "Pathfinder", kind: "orbiter", landingSiteName: null })],
      [launchEntry, landingEntry("failure")],
    );
    expect(sequenceOf(timeline).assets.map(({ name }) => name)).toEqual([
      "Prospector",
    ]);
  });

  it("brings a landing down at the place it will operate from", () => {
    const old = atMars({ key: "old", name: "Old", arrivedOnDay: -300 });
    const newcomer = atMars({});
    const timeline = shown(
      [missionAsset({})],
      [old, newcomer],
      [launchEntry, landingEntry("success")],
    );
    expect(sequenceOf(timeline).assets[0]?.place).toBe(1);
  });

  it("puts a crash clear of what's already at the site", () => {
    const old = atMars({ key: "old", name: "Old", arrivedOnDay: -300 });
    const elsewhere = atMars({ key: "e", landingSiteName: "Beta Basin" });
    const timeline = shown(
      [crashed(), crashed({ name: "Trailblazer", kind: "rover" })],
      [elsewhere, old],
      [launchEntry, landingEntry("failure")],
    );
    expect(sequenceOf(timeline).assets.map(({ place }) => place)).toEqual([
      1, 2,
    ]);
  });
});

describe("how far a landing sequence has got", () => {
  const sequence = sequenceOf(landed);

  it("is nowhere until its entry happens", () => {
    expect(sequenceNow(sequence, beforeLanding)).toBeNull();
    expect(sequenceNow(null, played(10))).toBeNull();
    expect(sequenceRunning(sequenceNow(sequence, beforeLanding))).toBe(false);
  });

  it("runs from its entry for the length of a sequence, and is over after that", () => {
    expect(sequenceNow(sequence, played(0))?.elapsedMs).toBe(0);
    expect(sequenceRunning(sequenceNow(sequence, played(0)))).toBe(true);
    expect(sequenceRunning(sequenceNow(sequence, played(sequenceMs - 1)))).toBe(
      true,
    );
    expect(sequenceRunning(sequenceNow(sequence, played(sequenceMs)))).toBe(
      false,
    );
  });

  it("takes long enough to see at any speed, because it goes by real time", () => {
    expect(sequenceMs).toBeGreaterThanOrEqual(5000);
  });
});

describe("what's coming down during a sequence", () => {
  const altitudes = (isCrash: boolean) =>
    [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 4900].map(
      (elapsedMs) => fallAt(isCrash, elapsedMs).altitude,
    );

  it.each([false, true])(
    "starts high and only comes down (crash: %s)",
    (isCrash) => {
      const [first] = altitudes(isCrash);
      expect(first).toBeGreaterThan(5);
      const heights = altitudes(isCrash);
      heights.slice(1).forEach((height, index) => {
        expect(height).toBeLessThanOrEqual(heights[index] ?? 0);
      });
    },
  );

  it("settles a landing gently on the ground before the sequence ends", () => {
    const [late, later] = [fallAt(false, 4500), fallAt(false, 4900)];
    expect(late.altitude).toBeLessThan(0.1);
    expect(later.altitude).toBeLessThan(late.altitude);
    expect(fallAt(false, sequenceMs).altitude).toBe(0);
    expect(fallAt(false, 3000).tilt).toBe(0);
  });

  it("brings a crash down fast and tilted, and it hits well before the end", () => {
    const sequence = sequenceOf(crash);
    const fell = (from: number, to: number) =>
      fallAt(true, from).altitude - fallAt(true, to).altitude;
    expect(fell(2000, 2400)).toBeGreaterThan(fell(0, 400) * 3);
    expect(fallAt(true, 2000).tilt).toBeGreaterThan(0.2);
    expect(hasImpacted({ sequence, elapsedMs: 0 })).toBe(false);
    expect(hasImpacted({ sequence, elapsedMs: sequenceMs / 2 })).toBe(true);
    expect(fallAt(true, sequenceMs / 2).altitude).toBe(0);
  });

  it("never reports impact for a landing", () => {
    const sequence = sequenceOf(landed);
    expect(hasImpacted({ sequence, elapsedMs: sequenceMs })).toBe(false);
  });
});

describe("the Landing Sites to choose between during a crash", () => {
  const sequence = sequenceOf(crash);
  const during = { sequence, elapsedMs: 1000 };
  const over = { sequence, elapsedMs: sequenceMs };

  it("adds the crash site with nothing else to show, so that the view stays on the surface", () => {
    const sites = sitesDuring([], during);
    expect(sites).toEqual(["Alpha Plain"]);
    expect(viewWithSites("surface", sites)).toBe("surface");
    expect(siteShown(sites, null)).toBe("Alpha Plain");
  });

  it("then lets the view go to Mars orbit once it's over, with nothing to choose", () => {
    const sites = sitesDuring([], over);
    expect(sites).toEqual([]);
    expect(viewWithSites("surface", sites)).toBe("marsOrbit");
    expect(siteShown(sites, null)).toBeNull();
  });

  it("goes first where other sites have Assets, then gives way to them", () => {
    expect(sitesDuring(["Beta Basin"], during)).toEqual([
      "Alpha Plain",
      "Beta Basin",
    ]);
    expect(sitesDuring(["Beta Basin"], over)).toEqual(["Beta Basin"]);
  });

  it("lists a site once when it already has Assets", () => {
    expect(sitesDuring(["Beta Basin", "Alpha Plain"], during)).toEqual([
      "Alpha Plain",
      "Beta Basin",
    ]);
  });

  it("leaves a successful landing's sites alone", () => {
    const now = { sequence: sequenceOf(landed), elapsedMs: 1000 };
    expect(sitesDuring(["Alpha Plain", "Beta Basin"], now)).toEqual([
      "Alpha Plain",
      "Beta Basin",
    ]);
  });

  it("leaves them alone with no sequence", () => {
    expect(sitesDuring(["Beta Basin"], null)).toEqual(["Beta Basin"]);
  });
});

describe("what the player reads during a sequence", () => {
  it("says it is a landing, at the site it's at", () => {
    const now = { sequence: sequenceOf(landed), elapsedMs: 1000 };
    expect(sequenceStatus(now, "Alpha Plain")).toBe("Landing: Prospector");
    expect(sequenceStatus(now, "Beta Basin")).toBeNull();
  });

  it("says it is a crash, naming everything lost", () => {
    const both = shown(
      [crashed(), crashed({ name: "Trailblazer", kind: "rover" })],
      [],
      [landingEntry("failure")],
    );
    const now = { sequence: sequenceOf(both), elapsedMs: 1000 };
    expect(sequenceStatus(now, "Alpha Plain")).toBe(
      "Crash: Prospector, Trailblazer",
    );
  });

  it("says nothing once it's over or before it starts", () => {
    const now = { sequence: sequenceOf(landed), elapsedMs: sequenceMs };
    expect(sequenceStatus(now, "Alpha Plain")).toBeNull();
    expect(sequenceStatus(null, "Alpha Plain")).toBeNull();
  });
});

describe("a sequence from a real Turn", () => {
  const catalogue = parseCatalogue(realCatalogueFiles());
  const simulation = createSimulation(catalogue);
  const plan = {
    mission: {
      launchVehicleId: "meridian-heavy",
      assetIds: ["pathfinder-orbiter", "prospector-lander"],
      landingSiteId: "jezero-crater",
    },
  };
  const turnWhere = (failedEvent: string | null) => {
    for (let seed = 1; seed < 100_000; seed++) {
      const result = simulation.runTurn(simulation.startProgram(seed), plan);
      if ((result.summary.failure?.missionEventName ?? null) === failedEvent) {
        return result;
      }
    }
    throw new Error(`No seed has the outcome ${failedEvent}`);
  };

  it("matches the failure entry of a crash, and the orbiter stays safe", () => {
    const { timeline } = turnWhere("Entry/descent/landing");
    const entry = timeline.entries.find(
      (candidate) =>
        candidate.kind === "missionEvent" && candidate.outcome === "failure",
    );
    const sequence = sequenceOf(timeline);
    expect(sequence.crashed).toBe(true);
    expect(sequence.day).toBe(entry?.day);
    expect(entry?.description).toContain(`crashed at ${sequence.siteName}`);
    expect(sequence.assets.map(({ name }) => name)).toEqual([
      "Prospector Lander",
    ]);
    expect(timeline.assetsAtMars.map(({ name }) => name)).toEqual([
      "Pathfinder Orbiter",
    ]);
  });

  it("matches the success entry of a landing", () => {
    const { timeline } = turnWhere(null);
    const sequence = sequenceOf(timeline);
    expect(sequence.crashed).toBe(false);
    expect(sequence.siteName).toBe("Jezero Crater");
    expect(timeline.entries[sequence.entryIndex]).toMatchObject({
      eventId: "entry-descent-landing",
      outcome: "success",
      day: sequence.day,
    });
  });

  it("has no sequence when orbit insertion fails first", () => {
    const { timeline } = turnWhere("Mars orbit insertion");
    expect(landingSequenceOf(timeline)).toBeNull();
  });
});
