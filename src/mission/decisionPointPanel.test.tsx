import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DecisionAnswer, DecisionPoint } from "../simulation/simulation";
import { DecisionPointAdvice, DecisionPointPanel } from "./DecisionPointPanel";

/** The text a reader would see, with tags gone and spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A Decision Point of this kind offering these two answers, with labels as Mission Mode shows them. */
function decisionPoint(
  kind: DecisionPoint["kind"],
  [first, second]: [[DecisionAnswer, string], [DecisionAnswer, string]],
): DecisionPoint {
  const choice = ([answer, label]: [DecisionAnswer, string]) => ({
    answer,
    label,
    riskBand: null,
    description: `What ${label} does.`,
  });
  return {
    id: `${kind}-1`,
    kind,
    day: 100,
    title: "Something happened",
    description: "Choose what to do.",
    assets: [],
    choices: [choice(first), choice(second)],
  };
}

const kinds: [
  DecisionPoint["kind"],
  [DecisionAnswer, string],
  [DecisionAnswer, string],
][] = [
  ["contingency", ["use", "Use the Contingency"], ["decline", "Decline"]],
  ["dustStorm", ["shelter", "Shelter"], ["carryOn", "Carry on"]],
  ["solarParticleEvent", ["safeMode", "Safe mode"], ["carryOn", "Carry on"]],
  ["goNoGo", ["holdOff", "Hold off"], ["go", "Go"]],
];

describe("Tutorial mode's suggestion at a Decision Point", () => {
  it.each(kinds)(
    "at a %s Decision Point, names the suggested choice with its reason and marks it",
    (kind, first, second) => {
      const point = decisionPoint(kind, [first, second]);
      const advice = { answer: second[0], reason: "It is the safer choice." };
      const html = renderToStaticMarkup(
        <>
          <DecisionPointAdvice decisionPoint={point} advice={advice} />
          <DecisionPointPanel
            decisionPoint={point}
            onAnswer={() => undefined}
            advice={advice}
          />
        </>,
      );
      expect(textOf(html)).toContain(`Tutorial mode suggests: ${second[1]}.`);
      expect(html).toContain(
        'class="tutorial-reason">It is the safer choice.</p>',
      );
      expect(html).toMatch(/class="decision-advice tutorial-voice"/);
      expect(html).toMatch(
        new RegExp(
          `data-testid="decision-choice-${second[0]}" class="suggested"`,
        ),
      );
      expect(html.match(/class="suggested"/g)?.length).toBe(1);
    },
  );

  it("shows no suggestion without advice, while Tutorial mode is off or has ended", () => {
    const point = decisionPoint("dustStorm", [
      ["shelter", "Shelter"],
      ["carryOn", "Carry on"],
    ]);
    const html = renderToStaticMarkup(
      <>
        <DecisionPointAdvice decisionPoint={point} advice={null} />
        <DecisionPointPanel decisionPoint={point} onAnswer={() => undefined} />
      </>,
    );
    expect(html).not.toContain("suggests");
    expect(html).not.toContain("suggested");
  });
});

describe("the primary choice at a Decision Point", () => {
  const storm = decisionPoint("dustStorm", [
    ["shelter", "Shelter"],
    ["carryOn", "Carry on"],
  ]);
  /** The labels of the buttons drawn as the primary button. */
  const primaryLabels = (html: string) =>
    [...html.matchAll(/<button[^>]*class="primary"[^>]*>([^<]*)</g)].map(
      ([, label]) => label,
    );

  it("is the choice Tutorial mode suggests, even when it is the second", () => {
    const html = renderToStaticMarkup(
      <DecisionPointPanel
        decisionPoint={storm}
        onAnswer={() => undefined}
        advice={{ answer: "carryOn", reason: "It earns more." }}
      />,
    );
    expect(primaryLabels(html)).toEqual(["Carry on"]);
  });

  it("is neither choice without a suggestion, as neither answer is a default", () => {
    const html = renderToStaticMarkup(
      <DecisionPointPanel decisionPoint={storm} onAnswer={() => undefined} />,
    );
    expect(primaryLabels(html)).toEqual([]);
  });
});
