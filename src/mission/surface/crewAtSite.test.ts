import { describe, expect, it } from "vitest";
import type { AssetAtMars } from "../../simulation/simulation";
import {
  crewFiguresOn,
  crewLandersStanding,
  crewOutsideAt,
} from "./crewAtSite";
import {
  sequenceMs,
  touchdownMs,
  type LandingSequence,
  type SequenceNow,
} from "./sequence";
import { describeSite, landerSpot, surfaceAssetsAt } from "./surface";

type CrewMember = NonNullable<AssetAtMars["crew"]>[number];

const member = (
  name: string,
  arrivedOnDay: number,
  overrides: Partial<CrewMember> = {},
): CrewMember => ({
  name,
  arrivedOnDay,
  fromDay: Math.max(arrivedOnDay, 0),
  untilDay: null,
  ...overrides,
});

/** The Crew's ship at Alpha Plain, as the Timeline has it. */
function shipWith(
  crew: CrewMember[],
  surfaceMotion: AssetAtMars["surfaceMotion"] = "nearby",
): AssetAtMars {
  return {
    key: "crew:landing-site:alpha-plain",
    name: "Odyssey",
    kind: "crew",
    landingSiteName: "Alpha Plain",
    activityName: "Field research",
    surfaceMotion,
    arrivedOnDay: Math.min(...crew.map(({ arrivedOnDay }) => arrivedOnDay)),
    fromDay: Math.min(...crew.map(({ fromDay }) => fromDay)),
    untilDay: null,
    crew,
  };
}

/** The Crew's ship at Alpha Plain, the only thing there, as the surface view shows it. */
function crewAt(
  crew: CrewMember[],
  surfaceMotion: AssetAtMars["surfaceMotion"] = "nearby",
) {
  const [shown] = surfaceAssetsAt(
    { assetsAtMars: [shipWith(crew, surfaceMotion)] },
    400,
    "Alpha Plain",
  );
  if (!shown) throw new Error("Expected the Crew's ship at the site");
  return shown;
}

const names = (figures: { name: string }[]) => figures.map(({ name }) => name);

const pair = [member("Ann Able", 205), member("Ben Baker", 205)];

/** The Crew's landing at Alpha Plain, this long after it started. */
const landing = (elapsedMs: number, lander = 0): SequenceNow => {
  const sequence: LandingSequence = {
    siteName: "Alpha Plain",
    day: 205,
    crashed: false,
    crewed: true,
    entryIndex: 3,
    assets: [{ name: "Odyssey", model: "crewLander", place: 0, lander }],
  };
  return { sequence, elapsedMs };
};

describe("the Crew at work at their Landing Site", () => {
  it("are each out on the surface from the day they land", () => {
    const crew = crewAt(pair);
    expect(crewFiguresOn(crew, 204, null)).toEqual([]);
    expect(names(crewFiguresOn(crew, 205, null))).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
  });

  it("are gone from the day each of them is lost", () => {
    const crew = crewAt([
      member("Ann Able", -100, { untilDay: 300 }),
      member("Ben Baker", -100),
    ]);
    expect(names(crewFiguresOn(crew, 299, null))).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
    expect(names(crewFiguresOn(crew, 300, null))).toEqual(["Ben Baker"]);
  });

  it("stay indoors while they shelter from a dust storm", () => {
    const shelter = { fromDay: 100, toDay: 200 };
    const crew = crewAt([
      member("Ann Able", -100, { shelter }),
      member("Ben Baker", -100, { shelter }),
    ]);
    expect(crewFiguresOn(crew, 99, null)).toHaveLength(2);
    expect(crewFiguresOn(crew, 150, null)).toEqual([]);
    expect(crewFiguresOn(crew, 200, null)).toHaveLength(2);
  });

  it("work in front of their lander, a little apart", () => {
    const [first, second] = crewFiguresOn(crewAt(pair, "still"), 400, null);
    const lander = landerSpot(0, 0);
    for (const figure of [first, second]) {
      expect(
        Math.hypot((figure?.x ?? 0) - lander.x, (figure?.z ?? 0) - lander.z),
      ).toBeLessThan(1.2);
      // In front is towards the camera.
      expect(figure?.z).toBeLessThan(lander.z);
    }
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeGreaterThan(0.3);
  });

  it("move about as their Activity has them do, and stand still with nothing to do", () => {
    const moving = crewAt(pair, "nearby");
    const still = crewAt(pair, "still");
    expect(crewFiguresOn(moving, 400, null)).not.toEqual(
      crewFiguresOn(moving, 420, null),
    );
    expect(crewFiguresOn(still, 400, null)).toEqual(
      crewFiguresOn(still, 420, null),
    );
  });

  it("stay aboard as their lander comes down, then step out of it once it has landed", () => {
    const crew = crewAt(pair, "still");
    expect(crewFiguresOn(crew, 205, landing(touchdownMs - 1))).toEqual([]);
    const lander = landerSpot(0, 0);
    const [stepping] = crewFiguresOn(crew, 205, landing(touchdownMs + 1));
    expect(stepping?.z).toBeCloseTo(lander.z, 1);
    expect(crewFiguresOn(crew, 205, landing(sequenceMs))).toEqual(
      crewFiguresOn(crew, 205, null),
    );
  });

  it("who were already there carry on while others land beside them", () => {
    const crew = crewAt([member("Ann Able", -575), member("Cal Cole", 205)]);
    expect(names(crewFiguresOn(crew, 205, landing(1000, 1)))).toEqual([
      "Ann Able",
    ]);
  });
});

describe("the Crew's landers at their Landing Site", () => {
  it("stand from the day their Crew land, one for each landing, while any of the Crew they brought are there", () => {
    const crew = crewAt([
      member("Ann Able", -575, { untilDay: 300 }),
      member("Cal Cole", 205),
    ]);
    expect(crewLandersStanding(crew, 100)).toEqual([0]);
    expect(crewLandersStanding(crew, 205)).toEqual([0, 1]);
    expect(crewLandersStanding(crew, 300)).toEqual([1]);
  });

  it("stand while their Crew shelter indoors", () => {
    const crew = crewAt([
      member("Ann Able", -100, { shelter: { fromDay: 0, toDay: 100 } }),
    ]);
    expect(crewLandersStanding(crew, 50)).toEqual([0]);
  });
});

describe("what the player reads about the Crew at their Landing Site", () => {
  const timeline = {
    mission: null,
    assetsAtMars: [
      shipWith([
        member("Ann Able", -100, { shelter: { fromDay: 100, toDay: 200 } }),
        member("Ben Baker", -100, {
          untilDay: 300,
          shelter: { fromDay: 100, toDay: 200 },
        }),
      ]),
    ],
  };

  it("names the Crew there and their Activity, or that they're sheltering", () => {
    expect(describeSite(timeline, 50, "Alpha Plain")).toEqual([
      "Crew (Odyssey): Ann Able, Ben Baker: Field research",
    ]);
    expect(describeSite(timeline, 150, "Alpha Plain")).toEqual([
      "Crew (Odyssey): Ann Able, Ben Baker: sheltering from the dust storm",
    ]);
    expect(describeSite(timeline, 300, "Alpha Plain")).toEqual([
      "Crew (Odyssey): Ann Able: Field research",
    ]);
  });

  it("counts the Crew out on the surface, for the browser tests", () => {
    expect(crewOutsideAt(timeline, 50, "Alpha Plain", null)).toEqual([
      "Ann Able",
      "Ben Baker",
    ]);
    expect(crewOutsideAt(timeline, 150, "Alpha Plain", null)).toEqual([]);
    expect(crewOutsideAt(timeline, 50, "Beta Basin", null)).toEqual([]);
  });
});
