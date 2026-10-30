import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = readFileSync("public/art/SOURCES.md", "utf8");

function sectionFor(fileName: string): string {
  const start = sources.indexOf(`## ${fileName}\n`);
  if (start === -1) return "";
  const end = sources.indexOf("\n## ", start + 1);
  return sources.slice(start, end === -1 ? undefined : end);
}

describe("art files (ADR 0005)", () => {
  const artFiles = readdirSync("public/art").filter(
    (fileName) => fileName !== "SOURCES.md",
  );

  it("includes the Earth and Mars maps", () => {
    expect(artFiles).toEqual(expect.arrayContaining(["earth.jpg", "mars.jpg"]));
  });

  it.each(artFiles)("%s has its source and licence recorded", (fileName) => {
    const section = sectionFor(fileName);
    expect(section).toMatch(/- Source: https:\/\//);
    expect(section).toMatch(/- Licence: \S+/);
  });
});
