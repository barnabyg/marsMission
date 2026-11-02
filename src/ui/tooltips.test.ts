import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tooltips } from "./tooltips";

const glossary = readFileSync("GLOSSARY.md", "utf8");

/** Every term the glossary defines, with its definition. */
const glossaryTerms = new Map(
  [...glossary.matchAll(/^\*\*(.+?)\*\*:\n(.+)$/gm)].map(
    ([, term, definition]) => [term ?? "", definition ?? ""],
  ),
);

/**
 * The words each term's definition avoids. An entry with a note in brackets, such as "Astronauts (as a game term)",
 * is avoided only in that sense, which a search can't judge, so it's left out.
 */
const avoidedWords = new Map(
  [...glossary.matchAll(/^\*\*(.+?)\*\*:\n.+\n_Avoid_: (.+)$/gm)].map(
    ([, term, avoided]) => [
      term ?? "",
      (avoided ?? "").split(", ").filter((word) => !word.includes("(")),
    ],
  ),
);

/** The avoided words this text uses, as whole words or plurals, once every glossary term is taken out of it. */
function avoidedWordsIn(text: string, avoided: string[]): string[] {
  const withoutTerms = [...glossaryTerms.keys()].reduce(
    (remaining, term) => remaining.replaceAll(term, ""),
    text,
  );
  return avoided.filter((word) =>
    new RegExp(`\\b${word}s?\\b`, "i").test(withoutTerms),
  );
}

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

  it("has no tooltip for a term the glossary doesn't define", () => {
    expect(
      Object.keys(tooltips).filter((term) => !glossaryTerms.has(term)),
    ).toEqual([]);
  });

  it.each([...glossaryTerms])(
    "has a tooltip in the glossary's wording for %s",
    (term, definition) => {
      const tooltip = (tooltips as Record<string, string | undefined>)[term];
      expect(tooltip, `no tooltip for ${term}`).toBeDefined();
      expect(tooltip?.startsWith(firstSentence(definition))).toBe(true);
    },
  );

  it("reads the Avoid lists properly", () => {
    expect(avoidedWords.get("Trajectory")).toEqual([
      "Route",
      "flight path",
      "transfer",
    ]);
    expect(avoidedWords.get("Crew")).toEqual(["personnel"]);
    expect(avoidedWordsIn("A Long traverse is no route.", ["route"])).toEqual([
      "route",
    ]);
    expect(avoidedWordsIn("It earns Ongoing Research.", ["research"])).toEqual(
      [],
    );
  });

  it.each([...avoidedWords])(
    "doesn't define %s with a word it avoids",
    (term, avoided) => {
      const tooltip = (tooltips as Record<string, string | undefined>)[term];
      expect(avoidedWordsIn(glossaryTerms.get(term) ?? "", avoided)).toEqual(
        [],
      );
      expect(avoidedWordsIn(tooltip ?? "", avoided)).toEqual([]);
    },
  );
});
