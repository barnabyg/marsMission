import { expect, test, type Locator, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { chooseAssets, viewButton } from "./helpers";
import { successSeed } from "./seeds";

/** A 4K monitor, at 150% Windows display scaling and at 100% (ADR 0001). */
const screenSizes = [
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

/** Whether the page, or any panel in Planning Mode, has more to show than fits on screen. */
function somethingScrolls(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const { scrollHeight, scrollWidth } = document.documentElement;
    const panels = [...document.querySelectorAll(".planning-columns .panel")];
    return (
      scrollHeight > innerHeight ||
      scrollWidth > innerWidth ||
      panels.some(
        (panel) =>
          panel.scrollHeight > panel.clientHeight ||
          panel.scrollWidth > panel.clientWidth,
      )
    );
  });
}

/** Whether all these elements sit side by side, on one line. */
async function onOneLine(elements: Locator[]): Promise<boolean> {
  const boxes = await Promise.all(elements.map((each) => each.boundingBox()));
  const middles = boxes.map((box) => (box ? box.y + box.height / 2 : -1));
  const lowest = Math.min(...middles);
  return lowest >= 0 && Math.max(...middles) - lowest < 10;
}

const realFiles = realCatalogueFiles();
/** Every Asset a new Program can choose, leaving out any that need Development first. */
const allAssets = realFiles.assets
  .filter(({ technologyReadiness }) => technologyReadiness !== "not-built")
  .map(({ name }) => name);
const realMilestones = realFiles.milestones;
const allLandingSiteIds = realFiles.landingSites.map(({ id }) => id);

/**
 * Opens Planning Mode with every Milestone earned and several operating Assets listed, and if asked,
 * with nothing left to Survey, which adds a note to each panel with an Asset set to Survey.
 */
async function openBusyProgram(
  page: Page,
  { allSurveyed = false, colossusBuilt = false } = {},
): Promise<void> {
  const saved = busyProgram(allSurveyed);
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify(
        colossusBuilt
          ? {
              // Format 8 holds Development, here with the Meridian Colossus built.
              formatVersion: 8,
              program: {
                ...saved.program,
                provenTechnologyIds: [],
                developments: [
                  { technologyId: "meridian-colossus", finishesOnTurn: 9 },
                ],
                operatingAssets: saved.program.operatingAssets.map((asset) => ({
                  ...asset,
                  flewUnproven: false,
                })),
              },
            }
          : saved,
      ),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("9");
}

/** A Program in save format 6 with every Milestone earned and several operating Assets. */
function busyProgram(allSurveyed: boolean) {
  return {
    formatVersion: 6,
    program: {
      seed: successSeed,
      turnNumber: 9,
      date: "2045-01-01",
      // Enough for every Asset that can fly, so that the only problem with them all is their mass.
      moneyMillions: 6000,
      publicSupport: 200,
      science: 800,
      milestoneIds: realMilestones.map(({ id }) => id),
      landedSiteIds: ["jezero-crater"],
      knownLandingSiteIds: allSurveyed
        ? allLandingSiteIds
        : ["jezero-crater", "gale-crater"],
      surveyedLandingSiteIds: allSurveyed ? allLandingSiteIds : [],
      fundingThresholdsPaid: [250],
      // A lander and a rover at a Landing Site too, whose rows are the longest and whose research lengthens the panel's text.
      operatingAssets: Array.from({ length: 8 }, (_, index) => ({
        ...(index < 6
          ? {
              assetId: "pathfinder-orbiter",
              name: "Pathfinder Orbiter",
              kind: "orbiter",
              landingSiteId: null,
              activityId: "survey",
            }
          : index < 7
            ? {
                assetId: "prospector-lander",
                name: "Prospector Lander",
                kind: "lander",
                landingSiteId: "jezero-crater",
                activityId: "surface-research",
              }
            : {
                assetId: "trailblazer-rover",
                name: "Trailblazer Rover",
                kind: "rover",
                landingSiteId: "jezero-crater",
                activityId: "long-traverse",
              }),
        arrivedOn: `203${index}-08-01`,
        serviceLifeDays: 9000,
        reliabilityLevelId: "none",
      })),
      status: { kind: "active" },
    },
  };
}

for (const size of screenSizes) {
  const sizeName = `${size.width}×${size.height}`;

  test.describe(`at ${sizeName}`, () => {
    test.use({ viewport: size });

    test("Planning Mode fits on one screen with a new Program", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await expect(page.getByTestId("turn-number")).toHaveText("1");
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of [
        "Launch Mission",
        "End Turn without launching",
        "Retire Program",
      ]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with everything chosen for a Mission", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      await expect(page.getByTestId("research-earnings")).toContainText(
        "Surface research earns 100 Science and 9 Public Support, and pays a $50M Research Grant.",
      );
      expect(await somethingScrolls(page)).toBe(false);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with several Milestones and operating Assets", async ({
      page,
    }) => {
      await openBusyProgram(page);
      // One in the Operating at Mars panel, and one for the orbiter the Mission starts with.
      await expect(page.getByTestId("research-earnings")).toHaveCount(2);
      expect(await somethingScrolls(page)).toBe(false);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
      const milestones = page.getByTestId("milestones").getByRole("listitem");
      const assets = page.getByTestId("operating-assets").getByRole("listitem");
      await expect(milestones).toHaveCount(realMilestones.length);
      await expect(assets).toHaveCount(8);
      await expect(milestones.last()).toBeInViewport({ ratio: 1 });
      await expect(assets.last()).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with a busy Program and a lander on the Mission", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
      await expect(
        page
          .locator(".panel", { hasText: "Operating at Mars" })
          .getByTestId("research-earnings"),
      ).toContainText("Research Grant");
      expect(await somethingScrolls(page)).toBe(false);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with every Asset ticked on a new Program", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, allAssets);
      // Too heavy and too dear for a new Program, so both problems show as well.
      await expect(page.getByRole("alert")).toHaveCount(2);
      expect(await somethingScrolls(page)).toBe(false);
      await expect(
        page.getByRole("button", { name: "End Turn without launching" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with a busy Program and every Asset on the Mission", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, allAssets);
      await expect(page.getByRole("alert")).toHaveCount(1);
      const mission = page
        .locator(".panel", { hasText: "Launch Vehicle" })
        .getByTestId("research-earnings");
      await expect(mission).toContainText("Soil analysis earns");
      await expect(mission).toContainText("Long traverse earns");
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      await expect(
        page.getByTestId("operating-assets").getByRole("listitem").last(),
      ).toContainText("Trailblazer Rover at Jezero Crater");
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with every Contingency on offer bought", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, allAssets);
      const contingencies = page.getByRole("checkbox", {
        name: /Contingency/,
      });
      await expect(contingencies.first()).toBeVisible();
      for (const contingency of await contingencies.all()) {
        await contingency.check();
      }
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByTestId("trajectory-details")).toContainText(
        "Swings back",
      );
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with the Meridian Colossus, its refuelling and everything else chosen", async ({
      page,
    }) => {
      await openBusyProgram(page, { colossusBuilt: true });
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-colossus");
      await chooseAssets(page, allAssets);
      await expect(
        page.getByTestId("mission-event").filter({ hasText: "Rendezvous" }),
      ).toBeVisible();
      for (const contingency of await page
        .getByRole("checkbox", { name: /Contingency/ })
        .all()) {
        await contingency.check();
      }
      for (const development of await page
        .getByRole("checkbox", { name: "Start Development" })
        .all()) {
        await development.check();
      }
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with a busy Program, every Asset and every Development chosen", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, allAssets);
      const developments = page.getByRole("checkbox", {
        name: "Start Development",
      });
      await expect(developments.first()).toBeVisible();
      for (const development of await developments.all()) {
        await development.check();
      }
      await expect(page.getByTestId("development-cost")).toBeVisible();
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with notes that nothing is left to Survey", async ({
      page,
    }) => {
      await openBusyProgram(page, { allSurveyed: true });
      await chooseAssets(page, allAssets);
      await expect(page.getByTestId("nothing-left-to-survey")).toHaveCount(2);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await somethingScrolls(page)).toBe(false);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("the Program summary fits on one screen with every Milestone earned", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await page.getByRole("button", { name: "Retire Program" }).click();
      await page
        .getByRole("dialog", { name: "Retire Program" })
        .getByRole("button", { name: "Yes, retire the Program" })
        .click();
      const summary = page.getByTestId("program-summary");
      await expect(summary.getByRole("listitem")).toHaveCount(
        realMilestones.length,
      );
      expect(await somethingScrolls(page)).toBe(false);
      await expect(
        page.getByRole("button", { name: "Start a new Program" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Mission Mode's controls fit on one line", async ({ page }) => {
      await page.goto(`/?seed=${successSeed}`);
      await page.getByRole("button", { name: "Launch Mission" }).click();
      const speeds = page
        .getByRole("group", { name: "Speed" })
        .getByRole("button");
      await expect(speeds.first()).toBeVisible();
      expect(
        await onOneLine([
          page.getByRole("heading", { name: "Mission Mode" }),
          page.getByTestId("mission-date"),
          page.getByRole("button", { name: "Mute sound" }),
          viewButton(page, "Solar system"),
          viewButton(page, "Mars orbit"),
          viewButton(page, "Surface"),
          viewButton(page, "Spacecraft"),
          speeds.first(),
          speeds.last(),
        ]),
      ).toBe(true);
      const progress = await page
        .getByRole("progressbar", { name: "Progress through the Turn" })
        .boundingBox();
      expect(progress?.width).toBeGreaterThan(100);
      expect(await somethingScrolls(page)).toBe(false);
    });

    test("text is the same size whatever the screen", async ({ page }) => {
      await page.goto(`/?seed=${successSeed}`);
      await expect(page.locator("html")).toHaveCSS("font-size", "18px");
    });
  });
}
