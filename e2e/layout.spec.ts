import { expect, test, type Locator, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { chooseAssets } from "./helpers";
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

const extraMilestones = Array.from({ length: 8 }, (_, index) => ({
  id: `milestone-${index}`,
  name: `Test Milestone ${index}`,
  description: "A Milestone that only this test has.",
  trigger: { assetKindArrives: "orbiter" },
  science: 1,
  publicSupport: 1,
}));

/** Opens Planning Mode with several Milestones and operating Assets listed. */
async function openBusyProgram(page: Page): Promise<void> {
  await page.route("**/data/milestones.json", (route) =>
    route.fulfill({ json: extraMilestones }),
  );
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify({
        formatVersion: 1,
        program: {
          seed: successSeed,
          turnNumber: 9,
          date: "2045-01-01",
          moneyMillions: 5000,
          publicSupport: 200,
          science: 800,
          milestoneIds: extraMilestones.map(({ id }) => id),
          fundingThresholdsPaid: [250],
          operatingAssets: Array.from({ length: 8 }, (_, index) => ({
            assetId: "pathfinder-orbiter",
            name: "Pathfinder Orbiter",
            kind: "orbiter",
            arrivedOn: `203${index}-08-01`,
          })),
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("9");
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
        "Surface research",
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
      await expect(milestones).toHaveCount(8);
      await expect(assets).toHaveCount(8);
      await expect(milestones.last()).toBeInViewport({ ratio: 1 });
      await expect(assets.last()).toBeInViewport({ ratio: 1 });
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
          speeds.first(),
          speeds.last(),
        ]),
      ).toBe(true);
      expect(await somethingScrolls(page)).toBe(false);
    });

    test("text is the same size whatever the screen", async ({ page }) => {
      await page.goto(`/?seed=${successSeed}`);
      await expect(page.locator("html")).toHaveCSS("font-size", "18px");
    });
  });
}
