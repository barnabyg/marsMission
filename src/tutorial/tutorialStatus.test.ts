import { describe, expect, it } from "vitest";
import {
  addDays,
  type DecisionPoint,
  type ProgramView,
} from "../simulation/simulation";
import { succeeding } from "../testing/realBalance";
import { changeOfCourse } from "./changeOfCourse";
import { followAdvice } from "./testHelpers";
import {
  crewAtBase,
  decisionAdvice,
  tutorialStatus,
  type DecisionAdvice,
  type TutorialStatus,
} from "./tutorial";

const route = followAdvice(succeeding, succeeding.startProgram(1), ({ view }) =>
  crewAtBase(view),
);
const atGoal = route.at(-1);
const start = route[0];
if (!atGoal || !start) throw new Error("Expected the route to be played");

describe("the tutorial's status", () => {
  it("is in progress at the start", () => {
    expect(tutorialStatus(start.view)).toEqual({ kind: "inProgress" });
  });

  it("has reached the goal once Crew are at a Base, with what was learnt", () => {
    const status: TutorialStatus = tutorialStatus(atGoal.view);
    expect(status.kind).toBe("goalReached");
    if (status.kind !== "goalReached") return;
    expect(status.learnt.length).toBeGreaterThan(3);
    for (const sentence of status.learnt)
      expect(sentence).toMatch(/^[A-Z].*\.$/);
  });

  it("isn't at the goal with Crew at a Base that has lost a part", () => {
    const withoutLab = {
      ...atGoal.view,
      operatingAssets: atGoal.view.operatingAssets.filter(
        ({ kind }) => kind !== "lab",
      ),
    };
    expect(crewAtBase(withoutLab)).toBe(false);
  });

  it("can't recover close to the Cancellation Level with too little money for a rover", () => {
    const poor = (
      publicSupport: number,
      moneyMillions: number,
    ): ProgramView => ({
      ...start.view,
      publicSupport: start.view.cancellationLevel + publicSupport,
      moneyMillions,
    });
    const status = tutorialStatus(poor(74, 999));
    expect(status.kind).toBe("cantRecover");
    if (status.kind === "cantRecover") {
      expect(status.reason).toContain(
        "Public Support is only 74 points above the Cancellation Level",
      );
    }
    expect(tutorialStatus(poor(75, 999)).kind).toBe("inProgress");
    expect(tutorialStatus(poor(74, 1000)).kind).toBe("inProgress");
  });

  it("can't recover once the Program is cancelled", () => {
    const status = tutorialStatus({
      ...start.view,
      status: { kind: "cancelled", reason: "Public Support fell too low." },
    });
    expect(status).toEqual({
      kind: "cantRecover",
      reason: "The Program was cancelled: Public Support fell too low.",
    });
  });
});

describe("a change of course after losses at Mars", () => {
  it("names a part of the Base that failed and Crew who were lost, and tries again", () => {
    const last = {
      view: atGoal.view,
      tools: atGoal.tools,
      plan: { mission: null },
    };
    const lab = atGoal.view.operatingAssets.find(({ kind }) => kind === "lab");
    const now: ProgramView = {
      ...atGoal.view,
      date: addDays(atGoal.view.date, 780),
      crew: [],
      operatingAssets: atGoal.view.operatingAssets.filter(
        (asset) => asset !== lab,
      ),
    };
    const crew = atGoal.view.crew.flatMap(({ members }) =>
      members.map(({ name }) => name),
    );
    const note = changeOfCourse(last, last.plan, now, {
      mission: {
        launchVehicleId: "meridian-medium",
        assetIds: [lab?.assetId ?? ""],
      },
    });
    expect(note).toBe(
      `${lab?.name ?? ""} at ${lab?.landingSiteName ?? ""} failed at Mars before its Service Life ended. ` +
        `${crew.join(" and ")} were lost at Mars. ` +
        `So this Turn tries again, sending ${lab?.name ?? ""}.`,
    );
  });
});

describe("advice at a Decision Point", () => {
  const point = (
    kind: DecisionPoint["kind"],
    answers: [DecisionAdvice["answer"], DecisionAdvice["answer"]],
  ): DecisionPoint => ({
    id: "decision",
    kind,
    day: 10,
    title: "A Decision Point",
    description: "Something happened.",
    assets: ["Trailblazer Rover"],
    siteName: "Gale Crater",
    choices: [
      {
        answer: answers[0],
        label: "First",
        riskBand: null,
        description: "The first choice.",
      },
      {
        answer: answers[1],
        label: "Second",
        riskBand: null,
        description: "The second choice.",
      },
    ],
  });
  const plan = { mission: null };

  it.each([
    ["contingency", ["decline", "use"], "use"],
    ["dustStorm", ["carryOn", "shelter"], "shelter"],
    ["solarParticleEvent", ["carryOn", "safeMode"], "safeMode"],
    ["goNoGo", ["go", "holdOff"], "holdOff"],
  ] as const)(
    "suggests the safe answer to a %s, with why",
    (kind, answers, safe) => {
      const advice = decisionAdvice(
        point(kind, [...answers]),
        start.view,
        plan,
      );
      expect(advice.answer).toBe(safe);
      expect(advice.reason).toMatch(/^[A-Z].*\.$/);
    },
  );

  it("speaks of the Crew when they are at stake", () => {
    const crewed = decisionAdvice(
      point("solarParticleEvent", ["carryOn", "safeMode"]),
      atGoal.view,
      {
        mission: {
          launchVehicleId: "meridian-colossus",
          assetIds: [],
          crew: { size: 2 },
        },
      },
    );
    expect(crewed.reason).toContain("the Crew");
  });

  it("suggests one of the choices offered even when the safe one isn't", () => {
    const advice = decisionAdvice(
      point("dustStorm", ["carryOn", "go"]),
      start.view,
      plan,
    );
    expect(advice).toEqual({
      answer: "carryOn",
      reason: "First: The first choice.",
    });
  });
});
