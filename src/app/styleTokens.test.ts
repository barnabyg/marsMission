import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Corners, colours and surfaces come from the tokens in styles.css, so that the same kind of thing looks the same on
// every screen. Every other style file uses them rather than writing the values out.
const styleFiles = readdirSync("src", { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".css"))
  .map((path) => `src/${path.replaceAll("\\", "/")}`);
const otherStyleFiles = styleFiles.filter(
  (path) => path !== "src/app/styles.css",
);

function declarations(path: string, property: string): string[] {
  const css = withoutComments(path);
  return [...css.matchAll(new RegExp(`(?<![\\w-])${property}:([^;}]+)`, "g"))]
    .map((match) => match[1] ?? "")
    .map((value) => value.trim());
}

function withoutComments(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("style tokens", () => {
  it("finds the style files", () => {
    expect(styleFiles).toContain("src/app/styles.css");
    expect(otherStyleFiles.length).toBeGreaterThan(10);
  });

  it.each(otherStyleFiles)(
    "%s rounds corners only with a radius token, a circle or its parent's",
    (path) => {
      const allowed = /^(var\(--radius(-sm|-pill)?\)|0|50%|inherit)$/;
      const wrong = declarations(path, "border(?:-[a-z]+)*-radius").filter(
        (value) => value.split(/\s+/).some((part) => !allowed.test(part)),
      );
      expect(wrong).toEqual([]);
    },
  );

  it.each(otherStyleFiles)(
    "%s writes no colour out: no hex, and rgb() only of a token's channels or black",
    (path) => {
      const css = withoutComments(path);
      const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      const rgb = (css.match(/rgba?\((?:[^()]|\([^()]*\))*\)/g) ?? []).filter(
        (value) => !/^rgb\((var\(--[\w-]+-rgb\)|0 0 0) \/ \d+%\)$/.test(value),
      );
      expect([...hex, ...rgb]).toEqual([]);
    },
  );

  it.each(styleFiles)("%s is under 500 lines", (path) => {
    expect(readFileSync(path, "utf8").split("\n").length).toBeLessThan(500);
  });
});
