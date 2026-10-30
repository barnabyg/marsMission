import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tooltips, type Term } from "./tooltips";

const glossary = readFileSync("GLOSSARY.md", "utf8");

/** Every term the glossary defines, with its definition. */
const glossaryTerms = new Map(
  [...glossary.matchAll(/^\*\*(.+?)\*\*:\n(.+)$/gm)].map(
    ([, term, definition]) => [term ?? "", definition ?? ""],
  ),
);

function firstSentence(text: string): string {
  return text.split(/(?<=\.) /)[0] ?? text;
}

describe("tooltip content", () => {
  it("reads the glossary properly", () => {
    expect(glossaryTerms.size).toBeGreaterThan(30);
    expect(glossaryTerms.get("Cancellation Level")).toContain(
      "below which the Program is cancelled",
    );
  });

  it.each([...glossaryTerms.keys()])("has a tooltip for %s", (term) => {
    expect(Object.keys(tooltips)).toContain(term);
  });

  it("has no tooltip for a term the glossary doesn't define", () => {
    expect(
      Object.keys(tooltips).filter((term) => !glossaryTerms.has(term)),
    ).toEqual([]);
  });

  it.each([...glossaryTerms])(
    "uses the glossary's wording for %s",
    (term, definition) => {
      expect(tooltips[term as Term].startsWith(firstSentence(definition))).toBe(
        true,
      );
    },
  );
});
