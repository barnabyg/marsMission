import { describe, expect, it } from "vitest";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";

describe("invalid data files", () => {
  it("reject an Asset that both lands and surveys", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-survey", "test-nothing"],
      })),
    });
    expect(message).toContain("can't both land and survey");
  });

  it("reject an Asset with an Activity that isn't in the data files", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["juggling"],
      })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain('the Activity "juggling"');
    expect(message).toContain("activities.json");
  });

  it("reject an Asset with no Activities", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({ ...asset, activities: [] })),
    });
    expect(message).toContain("assets.json");
    expect(message).toContain("activities");
  });

  it("reject an Asset that lists an Activity twice", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-nothing", "test-nothing"],
      })),
    });
    expect(message).toContain(
      'lists the Activity "test-nothing" more than once',
    );
  });

  it("reject an Activity whose id is used twice", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [...files.activities, ...files.activities],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain('"test-survey" is used more than once');
  });

  it("reject an Activity with an effect the game doesn't know", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "juggling",
          name: "Juggling",
          description: "Throws things.",
          effect: { kind: "juggling" },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain("effect");
  });

  it.each([
    ["a negative Science rate", { sciencePerTurn: -1 }, "sciencePerTurn"],
    ["a Science rate of zero", { sciencePerTurn: 0 }, "sciencePerTurn"],
    ["a fractional Science rate", { sciencePerTurn: 1.5 }, "sciencePerTurn"],
    ["a missing Science rate", { sciencePerTurn: undefined }, "sciencePerTurn"],
    [
      "a negative Public Support rate",
      { publicSupportPerTurn: -1 },
      "publicSupportPerTurn",
    ],
    [
      "a fractional Public Support rate",
      { publicSupportPerTurn: 0.5 },
      "publicSupportPerTurn",
    ],
  ])("reject a research Activity with %s", (_, rates, field) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "bad-research",
          name: "Bad research",
          description: "Earns the wrong amount.",
          effect: {
            kind: "research",
            sciencePerTurn: 10,
            publicSupportPerTurn: 1,
            researchKind: "test-unpaid",
            surfaceMotion: "nearby",
            ...rates,
          },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain(field);
  });

  it.each([
    ["a missing kind of research", undefined, "researchKind"],
    ["an unknown kind of research", "no-such-kind", '"no-such-kind"'],
  ])("reject a research Activity with %s", (_, researchKind, expected) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: [
        ...files.activities,
        {
          id: "bad-research",
          name: "Bad research",
          description: "Has the wrong kind.",
          effect: {
            kind: "research",
            sciencePerTurn: 10,
            publicSupportPerTurn: 1,
            researchKind,
            surfaceMotion: "nearby",
          },
        },
      ],
    });
    expect(message).toContain("activities.json");
    expect(message).toContain(expected);
  });

  it.each([
    ["negative", -0.5],
    ["missing", undefined],
    ["not a number", "1"],
  ])("reject a Research Grant rate that is %s", (_, rate) => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      researchKinds: [
        { id: "bad-kind", name: "Bad", grantMillionsPerScience: rate },
      ],
    });
    expect(message).toContain("research-kinds.json");
    expect(message).toContain("grantMillionsPerScience");
  });

  it("reject two kinds of research with the same id", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      researchKinds: [...files.researchKinds, ...files.researchKinds],
    });
    expect(message).toContain("research-kinds.json");
    expect(message).toContain("more than once");
  });

  it("reject data files with no Activity that does nothing", () => {
    const files = testCatalogueFiles();
    const message = errorFrom({
      ...files,
      activities: files.activities.filter(
        ({ effect }) => effect.kind !== "nothing",
      ),
      assets: files.assets.map((asset) => ({
        ...asset,
        activities: ["test-survey"],
        landsAtSite: false,
      })),
    });
    expect(message).toContain("activities.json");
    expect(message).toContain('"nothing" effect');
  });
});
