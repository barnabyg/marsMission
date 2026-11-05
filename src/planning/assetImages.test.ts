import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { realCatalogueFiles } from "../testing/realCatalogue";
import { assetImageFolder, crewImageKind } from "./assetImages";

const folder = `public/${assetImageFolder}`;
const kinds = [
  ...new Set(realCatalogueFiles().assets.map(({ kind }) => kind)),
  crewImageKind,
];

describe("the Asset cards' pictures", () => {
  // A new kind of Asset needs a model chosen in src/mission/assetArt/AssetArt.tsx, then scripts/generate-asset-art.mjs.
  it.each(kinds)("has one for the %s kind", (kind) => {
    expect(existsSync(`${folder}/${kind}.png`)).toBe(true);
  });

  it("records each as made from the game's own models", () => {
    const sources = readFileSync("public/art/SOURCES.md", "utf8");
    for (const fileName of readdirSync(folder)) {
      expect(sources).toContain(`\`assets/${fileName}\``);
    }
  });
});
