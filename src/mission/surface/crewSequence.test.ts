import { describe, expect, it } from "vitest";
import type {
  AssetAtMars,
  Timeline,
  TimelineEntry,
} from "../../simulation/simulation";
import { landingSequenceOf, sequenceKind, sequenceStatus } from "./sequence";

type Mission = NonNullable<Timeline["mission"]>;
type MissionAsset = Mission["assets"][number];
type MissionEventEntry = Extract<TimelineEntry, { kind: "missionEvent" }>;

const crewShip = (overrides: Partial<MissionAsset> = {}): MissionAsset => ({
  name: "Odyssey",
  kind: "crew",
  landingSiteName: "Alpha Plain",
  deliveredOnDay: 205,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

const member = (name: string, arrivedOnDay: number) => ({
  name,
  arrivedOnDay,
  fromDay: Math.max(arrivedOnDay, 0),
  untilDay: null,
});

const crewAtSite = (crew: AssetAtMars["crew"] = []): AssetAtMars => ({
  key: "crew:landing-site:alpha-plain",
  name: "Odyssey",
  kind: "crew",
  landingSiteName: "Alpha Plain",
  activityName: "Field research",
  surfaceMotion: "nearby",
  arrivedOnDay: Math.min(...crew.map(({ arrivedOnDay }) => arrivedOnDay)),
  fromDay: Math.min(...crew.map(({ fromDay }) => fromDay)),
  untilDay: null,
  crew,
});

const lander: AssetAtMars = {
  key: "prospector:2030",
  name: "Prospector",
  kind: "lander",
  landingSiteName: "Alpha Plain",
  activityName: "Nothing",
  surfaceMotion: "still",
  arrivedOnDay: -300,
  fromDay: 0,
  untilDay: null,
};

const landingEntry = (outcome: "success" | "failure"): MissionEventEntry => ({
  kind: "missionEvent",
  day: 205,
  eventId: "entry-descent-landing",
  title: "Entry/descent/landing",
  description: "",
  outcome,
});

function sequenceOf(
  assets: MissionAsset[],
  assetsAtMars: AssetAtMars[],
  outcome: "success" | "failure" = "success",
) {
  const sequence = landingSequenceOf({
    assetsAtMars,
    entries: [landingEntry(outcome)],
    mission: {
      launchDay: 0,
      arrivalDay: 200,
      launchVehicleName: "Meridian Colossus",
      assetNames: assets.map(({ name }) => name),
      assets,
      failedOnDay: outcome === "failure" ? 205 : null,
    },
  });
  if (!sequence) throw new Error("Expected a landing sequence");
  return sequence;
}

const newcomers = [member("Cal Cole", 205), member("Dee Dunn", 205)];

describe("a Crew landing's sequence", () => {
  it("is a Crew landing of its own, bringing down the Crew's lander", () => {
    const sequence = sequenceOf([crewShip()], [crewAtSite(newcomers)]);
    expect(sequence.crewed).toBe(true);
    expect(sequence.crashed).toBe(false);
    expect(sequence.assets).toEqual([
      { name: "Odyssey", model: "crewLander", place: 0, lander: 0 },
    ]);
    expect(sequenceStatus({ sequence, elapsedMs: 0 }, "Alpha Plain")).toBe(
      "Crew landing: Odyssey",
    );
  });

  it("brings a second lander down beside the Crew already at the site, which they join", () => {
    const sequence = sequenceOf(
      [crewShip()],
      [
        lander,
        crewAtSite([
          member("Ann Able", -575),
          member("Ben Baker", -575),
          ...newcomers,
        ]),
      ],
    );
    expect(sequence.assets).toEqual([
      { name: "Odyssey", model: "crewLander", place: 1, lander: 1 },
    ]);
  });

  it("is a Crew crash of its own when entry/descent/landing fails, beside what's already there", () => {
    const sequence = sequenceOf(
      [crewShip({ deliveredOnDay: null, lostOnDay: 205, crashed: true })],
      [lander, crewAtSite([member("Ann Able", -575)])],
      "failure",
    );
    expect(sequence).toMatchObject({ crewed: true, crashed: true });
    expect(sequence.assets).toEqual([
      { name: "Odyssey", model: "crewLander", place: 2, lander: 0 },
    ]);
    expect(sequenceStatus({ sequence, elapsedMs: 0 }, "Alpha Plain")).toBe(
      "Crew crash: Odyssey",
    );
  });

  it("brings a lander down with the Crew in the same sequence, each in its own place", () => {
    const sequence = sequenceOf(
      [{ ...crewShip(), name: "Prospector", kind: "lander" }, crewShip()],
      [{ ...lander, arrivedOnDay: 205, fromDay: 205 }, crewAtSite(newcomers)],
    );
    expect(sequence.crewed).toBe(true);
    expect(
      sequence.assets.map(({ place, lander: index }) => [place, index]),
    ).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("is no Crew landing when only robots come down", () => {
    const sequence = sequenceOf(
      [{ ...crewShip(), name: "Prospector", kind: "lander" }],
      [{ ...lander, arrivedOnDay: 205, fromDay: 205 }],
    );
    expect(sequence.crewed).toBe(false);
    expect(sequenceStatus({ sequence, elapsedMs: 0 }, "Alpha Plain")).toBe(
      "Landing: Prospector",
    );
  });
});

describe("telling the four sequences apart", () => {
  it.each([
    [false, false, "landing"],
    [true, false, "crash"],
    [false, true, "crew-landing"],
    [true, true, "crew-crash"],
  ] as const)("crashed %s, crewed %s is a %s", (crashed, crewed, kind) => {
    expect(sequenceKind({ crashed, crewed })).toBe(kind);
  });
});
