import { describe, expect, it } from "vitest";
import { glossaryTerms } from "./Glossary";

describe("the glossary's terms", () => {
  it("lists each term once, in alphabetical order", () => {
    expect(glossaryTerms(["Mission", "Asset", "Mission", null])).toEqual([
      "Asset",
      "Mission",
    ]);
  });

  it("splits the several terms a heading's marker names", () => {
    expect(glossaryTerms(["Turn|Launch Window"])).toEqual([
      "Launch Window",
      "Turn",
    ]);
  });

  it("leaves out anything that isn't a game term", () => {
    expect(glossaryTerms(["Not a term", ""])).toEqual([]);
  });
});
