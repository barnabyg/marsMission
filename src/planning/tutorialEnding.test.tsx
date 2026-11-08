import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TutorialEnding } from "./TutorialEnding";

/** The text a reader would see, with tags gone and spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

describe("how the tutorial ends", () => {
  it("at its goal, says so and sums up what was learnt", () => {
    const text = textOf(
      renderToStaticMarkup(
        <TutorialEnding
          ending={{
            kind: "goalReached",
            learnt: ["Surveys make landings safer."],
          }}
          onClose={() => undefined}
        />,
      ),
    );
    expect(text).toContain("Tutorial complete");
    expect(text).toContain("Crew have landed at a Base");
    expect(text).toContain("Surveys make landings safer.");
  });

  it("when it can't recover, says what went wrong and that the Program carries on", () => {
    const text = textOf(
      renderToStaticMarkup(
        <TutorialEnding
          ending={{
            kind: "cantRecover",
            reason: "Public Support is too close to the Cancellation Level.",
          }}
          onClose={() => undefined}
        />,
      ),
    );
    expect(text).toContain("Tutorial ended");
    expect(text).toContain(
      "Public Support is too close to the Cancellation Level.",
    );
    expect(text).toContain("The Program carries on");
  });
});
