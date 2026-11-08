import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DecisionAnswer, DecisionPoint } from "../simulation/simulation";
import { DecisionPointPanel } from "./DecisionPointPanel";

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
      const html = renderToStaticMarkup(
        <DecisionPointPanel
          decisionPoint={decisionPoint(kind, [first, second])}
          onAnswer={() => undefined}
          advice={{ answer: second[0], reason: "It is the safer choice." }}
        />,
      );
      expect(textOf(html)).toContain(
        `Tutorial mode suggests: ${second[1]}. It is the safer choice.`,
      );
      expect(html).toMatch(
        new RegExp(
          `data-testid="decision-choice-${second[0]}" class="suggested"`,
        ),
      );
      expect(html.match(/class="suggested"/g)?.length).toBe(1);
    },
  );

  it("shows no suggestion without advice, while Tutorial mode is off or has ended", () => {
    const html = renderToStaticMarkup(
      <DecisionPointPanel
        decisionPoint={decisionPoint("dustStorm", [
          ["shelter", "Shelter"],
          ["carryOn", "Carry on"],
        ])}
        onAnswer={() => undefined}
      />,
    );
    expect(html).not.toContain("suggests");
    expect(html).not.toContain("suggested");
  });
});
