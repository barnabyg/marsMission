import { describe, expect, it } from "vitest";
import { failing, succeeding } from "../testing/realBalance";
import { followAdvice, play, startOf } from "./testHelpers";
import {
  crewAtBase,
  stages,
  type AdviceItem,
  type AdviceTopic,
  type Stage,
  type StageId,
} from "./tutorial";

const topics = (start: ReturnType<typeof startOf>) =>
  start.advice.items.map(({ topic }) => topic);

describe("advice for a Planning session", () => {
  const first = startOf(succeeding, succeeding.startProgram(1));

  it("starts with an orbiter to Survey, and no change of course", () => {
    const { advice, view, tools } = first;
    expect(advice.stage).toBe("firstOrbiter");
    expect(advice.changeOfCourse).toBeNull();
    expect(tools.problemsWith(advice.plan)).toEqual([]);
    expect(topics(first)).toEqual(
      expect.arrayContaining<AdviceTopic>([
        "launchVehicle",
        "assets",
        "trajectory",
        "reliability",
        "activities",
      ]),
    );
    const orbiter = view.assets.find(({ kind }) => kind === "orbiter");
    expect(advice.items.find(({ topic }) => topic === "assets")?.advice).toBe(
      `Send ${orbiter?.name ?? ""}.`,
    );
    expect(
      advice.items.find(({ topic }) => topic === "activities")?.advice,
    ).toContain("Survey");
    const items: AdviceItem[] = advice.items;
    for (const { advice: text, reason } of items) {
      expect(text).toMatch(/^[A-Z].*\.$/);
      expect(reason).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("goes on to land after a success, with no change of course", () => {
    const second = startOf(
      succeeding,
      play(succeeding, first, first.advice.plan),
      {
        start: first,
        plan: first.advice.plan,
      },
    );
    expect(second.advice.changeOfCourse).toBeNull();
    expect(second.advice.stage).toBe("landingAndSurveys");
    expect(second.tools.problemsWith(second.advice.plan)).toEqual([]);
    expect(topics(second)).toContain("landingSite");
    expect(second.advice.plan.mission?.assetIds).toEqual([
      second.view.assets.find(({ kind }) => kind === "rover")?.id,
    ]);
  });

  it("says why it changed course after a failure, and tries again", () => {
    // Without its Reliability, which changes none of the main choices, every Mission Event fails.
    const { mission } = first.advice.plan;
    if (!mission) throw new Error("Expected a Mission");
    const { reliability, ...unreliable } = mission;
    expect(reliability).toBeDefined();
    const plan = { ...first.advice.plan, mission: unreliable };
    const second = startOf(failing, play(failing, first, plan), {
      start: first,
      plan,
    });
    expect(second.advice.stage).toBe("firstOrbiter");
    expect(second.advice.changeOfCourse).toMatch(
      /^The Mission carrying .+ failed\. So this Turn tries again, sending .+\.$/,
    );
    expect(second.advice.plan.mission?.assetIds).toEqual(
      first.advice.plan.mission?.assetIds,
    );
    expect(second.tools.problemsWith(second.advice.plan)).toEqual([]);
  });

  it("says neutrally when the last Turn didn't follow the advice", () => {
    const skipped = { mission: null };
    const second = startOf(succeeding, play(succeeding, first, skipped), {
      start: first,
      plan: skipped,
    });
    expect(second.advice.changeOfCourse).toMatch(
      /^Last Turn's plan went a different way from the advice, launching nothing rather than sending .+\. This Turn's advice picks up from where the Program is now, sending .+\.$/,
    );
    expect(second.advice.stage).toBe("firstOrbiter");
  });

  it("explains a Turn with nothing to launch", () => {
    const broke = startOf(succeeding, {
      ...first.program,
      moneyMillions: 0,
    });
    expect(broke.advice.plan.mission).toBeNull();
    expect(broke.advice.items.map(({ topic }) => topic)).toEqual(["noLaunch"]);
  });
});

describe("following the advice every Turn", () => {
  const route = followAdvice(
    succeeding,
    succeeding.startProgram(1),
    ({ view }) => crewAtBase(view),
  );

  it("reaches Crew at a Base, through every stage in order, with valid plans", () => {
    const last = route.at(-1);
    expect(last && crewAtBase(last.view)).toBe(true);
    const seen = route.map(({ advice }) => advice.stage);
    const order: StageId[] = stages.map(({ id }: Stage) => id);
    expect([...new Set(seen)]).toEqual(order);
    for (const { tools, advice } of route) {
      expect(tools.problemsWith(advice.plan)).toEqual([]);
    }
  });

  it("explains the Development, the Base and the Crew it advises", () => {
    const items = route.flatMap(({ advice }) => advice.items);
    const advised = (topic: AdviceTopic) =>
      items.filter((item) => item.topic === topic).map(({ advice }) => advice);
    expect(advised("development")).toContain(
      "Start the Development of the Meridian Colossus.",
    );
    expect(advised("assets")).toContainEqual(
      expect.stringMatching(
        /^Send Wellspring Fuel Plant, Haven Module,? (and )?Curie Station/,
      ),
    );
    expect(advised("crew").at(-1)).toMatch(
      /^Send a Crew of 2 on a round trip, landing at .+\.$/,
    );
    expect(advised("supplies").length).toBeGreaterThan(0);
    expect(advised("protection").length).toBeGreaterThan(0);
    expect(advised("serviceLife")).toContain(
      "Buy the longest Service Life for Wellspring Fuel Plant, Haven Module and Curie Station.",
    );
  });
});
