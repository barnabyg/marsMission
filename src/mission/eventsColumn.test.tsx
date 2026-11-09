import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Timeline } from "../simulation/simulation";
import { EventsColumn } from "./EventsColumn";

/** The text a reader would see, with tags gone and spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A Turn that has stopped at a Decision Point, after one Hazard. Only what the events column reads is filled in. */
const timeline = {
  startDate: "2029-01-01",
  entries: [
    {
      kind: "hazard",
      hazard: "dustStorm",
      day: 10,
      title: "Dust storm at Jezero Crater",
      description: "A storm blew over and passed.",
    },
    {
      kind: "decisionPoint",
      hazard: "dustStorm",
      day: 20,
      title: "Go/no-go check at Jezero Crater: Decision Point",
      description: "A dust storm is over Jezero Crater.",
    },
  ],
} as unknown as Timeline;

describe("the Decision Point's card in the events column", () => {
  it("leaves its sentence to the Decision Point panel while that is open, so it shows once", () => {
    const text = textOf(
      renderToStaticMarkup(
        <EventsColumn timeline={timeline} entriesHappened={2} deciding />,
      ),
    );
    expect(text).toContain("Go/no-go check at Jezero Crater: Decision Point");
    expect(text).toContain("21 January 2029");
    expect(text).not.toContain("A dust storm is over Jezero Crater.");
    // Only the open Decision Point's card is shortened.
    expect(text).toContain("A storm blew over and passed.");
  });

  it("shows its sentence once the Decision Point is answered", () => {
    const text = textOf(
      renderToStaticMarkup(
        <EventsColumn
          timeline={timeline}
          entriesHappened={2}
          deciding={false}
        />,
      ),
    );
    expect(text).toContain("A dust storm is over Jezero Crater.");
  });
});
