import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stages, type PlanningAdvice } from "../tutorial/tutorial";
import { TutorialAdvice } from "./TutorialAdvice";
import { TutorialPanel } from "./TutorialPanel";

/** The text a reader would see, with tags gone and spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const advice: PlanningAdvice = {
  stage: "landingAndSurveys",
  changeOfCourse: null,
  items: [
    {
      topic: "assets",
      advice: "Send the Pathfinder Lander.",
      reason: "A first landing earns a Milestone.",
    },
    {
      topic: "landingSite",
      advice: "Land at Jezero Crater.",
      reason: "A Survey has made it safer.",
    },
  ],
  plan: { mission: null },
};

describe("the tutorial's advice in Planning Mode", () => {
  it("says what to plan this Turn and why, choice by choice, with game terms given tooltips", () => {
    const html = renderToStaticMarkup(<TutorialAdvice advice={advice} />);
    const text = textOf(html);
    expect(text).toContain(
      "Send the Pathfinder Lander.A first landing earns a Milestone.",
    );
    expect(text).toContain("Land at Jezero Crater.A Survey has made it safer.");
    expect(html).toContain('data-term="Milestone"');
    expect(html).toContain('data-topic="landingSite"');
  });

  it("shows the stage the Program is at, with the whole route and the stages before it done", () => {
    const html = renderToStaticMarkup(<TutorialAdvice advice={advice} />);
    const second = stages[1];
    expect(textOf(html)).toContain(
      `Stage 2 of ${stages.length}: ${second?.name ?? ""}`,
    );
    expect(textOf(html)).toContain(second?.aim ?? "");
    expect(html.match(/<li/g)?.length).toBe(stages.length + 2);
    expect(html).toMatch(/aria-current="step"[^>]*>[^<]*/);
    expect(html.match(/class="done"/g)?.length).toBe(1);
  });

  it("keeps the whole route behind a disclosure, closed until the player opens it", () => {
    const html = renderToStaticMarkup(<TutorialAdvice advice={advice} />);
    expect(html).toMatch(
      /<details[^>]*><summary>Show the route<\/summary><ol[^>]*aria-label="The route"/,
    );
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("says why it changed course before anything else", () => {
    const html = renderToStaticMarkup(
      <TutorialAdvice
        advice={{
          ...advice,
          changeOfCourse:
            "The lander failed, so this Turn we try the same Landing Site again.",
        }}
      />,
    );
    const text = textOf(html);
    expect(text.indexOf("The lander failed")).toBe(0);
  });

  it("offers no way to fill in the plan", () => {
    const html = renderToStaticMarkup(<TutorialAdvice advice={advice} />);
    expect(html).not.toContain("<button");
  });
});

describe("the Tutorial mode panel", () => {
  const panel = (kind: "off" | "on", firstTurn: boolean) =>
    renderToStaticMarkup(
      <TutorialPanel
        tutorial={{ kind }}
        firstTurn={firstTurn}
        onTutorialChange={() => undefined}
      >
        <p>The advice</p>
      </TutorialPanel>,
    );

  it("offers Tutorial mode only on a Program's first Turn", () => {
    expect(panel("off", true)).toContain("Turn on Tutorial mode");
    expect(panel("off", false)).toBe("");
  });

  it("shows the advice while it is on, with a way to turn it off", () => {
    const html = panel("on", false);
    expect(html).toContain("The advice");
    expect(html).toContain("Turn off Tutorial mode");
  });

  it("heads the panel with only its title, and says at its foot, after the advice, that it is only advice, with the way to turn it off", () => {
    const html = panel("on", false);
    expect(textOf(html).indexOf("Tutorial mode")).toBe(0);
    const footer = html.indexOf('class="tutorial-footer"');
    expect(html.indexOf("The advice")).toBeLessThan(footer);
    expect(html.indexOf("you set every choice yourself")).toBeGreaterThan(
      footer,
    );
    expect(html.indexOf("Turn off Tutorial mode")).toBeGreaterThan(footer);
  });

  it("speaks in the tutorial's own style while it is on, but not while only offering it", () => {
    expect(panel("on", false)).toContain("tutorial-voice");
    expect(panel("off", true)).not.toContain("tutorial-voice");
  });

  it("shows nothing once the tutorial has ended", () => {
    expect(
      renderToStaticMarkup(
        <TutorialPanel
          tutorial={{ kind: "ended", outcome: "goalReached" }}
          firstTurn={false}
          onTutorialChange={() => undefined}
        />,
      ),
    ).toBe("");
  });
});
