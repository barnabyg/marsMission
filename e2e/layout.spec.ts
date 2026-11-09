import { expect, test, type Page } from "@playwright/test";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import {
  chooseAssets,
  endTurnWithoutLaunching,
  overrideProgramData,
} from "./helpers";
import { openLaunchStep } from "./planningHelpers";
import { openBusyProgram, realMilestones } from "./busyProgram";
import { screenSizes, whatScrolls, unreadableText } from "./layoutHelpers";
import { successSeed } from "./seeds";

const realFiles = realCatalogueFiles();
/**
 * Every Asset a new Program can choose, leaving out any that need Development first, and the fuel plant, the habitat,
 * the Mars lab, the ascent vehicle and the Earth return orbiter, which the Meridian Colossus can't carry beside all the
 * others.
 */
const allAssets = realFiles.assets
  .filter(
    ({ technologyReadiness, makes, habitat, benefit, sampleReturn }) =>
      technologyReadiness !== "not-built" &&
      makes === undefined &&
      habitat === undefined &&
      benefit?.raises !== "siteResearchGrants" &&
      sampleReturn === undefined,
  )
  .map(({ name }) => name);

/** Ticks every Asset that can fly, on the Meridian Colossus, the only Launch Vehicle that carries them all. */
async function chooseEveryAsset(page: Page): Promise<void> {
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await chooseAssets(page, allAssets);
}

for (const size of screenSizes) {
  const sizeName = `${size.width}×${size.height}`;

  test.describe(`at ${sizeName}`, () => {
    test.use({ viewport: size });

    test("Planning Mode fits on one screen with a new Program", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
      await expect(page.getByTestId("turn-number")).toHaveText("1");
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of [
        "Launch Mission",
        "End Turn without launching",
        "Restart Program",
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
      // On the Meridian Heavy, as the two are too heavy for the first Launch Vehicle.
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-heavy");
      await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      await expect(
        page.locator(".mission-panel").getByTestId("activity-earnings").last(),
      ).toHaveText(
        "Surface research earns 100 Science, 9 Public Support and $50M Research Grant a Turn.",
      );
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with several Milestones and operating Assets", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
      // Each Asset at Mars that earns something says what, here the lander and the rover; a Survey's choice names it.
      await expect(
        page.getByTestId("operating-assets").getByTestId("activity-earnings"),
      ).toHaveCount(2);
      await expect(
        page.locator(".mission-panel").getByTestId("activity-earnings"),
      ).toHaveCount(1);
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
      const milestones = page.getByTestId("milestones").getByRole("listitem");
      const assets = page.getByTestId("operating-asset");
      await expect(milestones).toHaveCount(realMilestones.length);
      await expect(assets).toHaveCount(8);
      // At 1920×1080 the panels beside the New Mission may scroll, so each is scrolled to its end first.
      for (const last of [milestones.last(), assets.last()]) {
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport({ ratio: 1 });
      }
    });

    test("Planning Mode fits on one screen with a busy Program and a lander on the Mission", async ({
      page,
    }) => {
      await openBusyProgram(page);
      // On the Meridian Heavy, as the two are too heavy for the first Launch Vehicle.
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-heavy");
      await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
      await expect(
        page.getByTestId("operating-assets").getByTestId("activity-earnings"),
      ).toContainText(["Research Grant"]);
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Launch Mission" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("the status bar keeps its values on one row, evenly spaced, with a busy Program's large figures", async ({
      page,
    }) => {
      await openBusyProgram(page);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
      await page.evaluate(() => document.fonts.ready);
      const boxes = await page
        .locator(".status-bar dl > div")
        .evaluateAll((values) =>
          values.map(
            (value) => value.getBoundingClientRect().toJSON() as DOMRect,
          ),
        );
      const tops = new Set(boxes.map(({ top }) => Math.round(top)));
      expect(tops.size).toBe(1);
      const gaps = boxes
        .slice(1)
        .map((box, index) => box.left - (boxes[index]?.right ?? 0));
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
      expect(Math.min(...gaps)).toBeGreaterThan(0);
    });

    test("Planning Mode fits on one screen with every Asset that fits ticked on a new Program", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-heavy");
      // Ticking one can leave the next unable to fit, so each is looked at in turn.
      for (const box of await page
        .locator(".asset-choice")
        .getByRole("checkbox")
        .all()) {
        if (await box.isEnabled()) await box.check();
      }
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(
        page.locator(".asset-choice.unavailable").first(),
      ).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        page.getByRole("button", { name: "End Turn without launching" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("Planning Mode fits on one screen with a busy Program and every Asset on the Mission", async ({
      page,
    }) => {
      await openBusyProgram(page, { colossusBuilt: true });
      await chooseEveryAsset(page);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(
        page
          .locator(".mission-panel")
          .getByTestId("activity-earnings")
          .filter({ hasText: "Soil analysis earns" }),
      ).toHaveCount(1);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      await expect(page.getByTestId("operating-asset").last()).toContainText(
        "Trailblazer Rover",
      );
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with every Contingency on offer bought", async ({
      page,
    }) => {
      await openBusyProgram(page, { colossusBuilt: true });
      await chooseEveryAsset(page);
      const contingencies = page.getByRole("checkbox", {
        name: /Contingency/,
      });
      await expect(contingencies.first()).toBeVisible();
      for (const contingency of await contingencies.all()) {
        await contingency.check();
      }
      await openLaunchStep(page);
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByTestId("trajectory-details")).toContainText(
        "Swings back",
      );
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      expect(
        await unreadableText(
          page.locator(
            "[data-testid=trajectory-details], [data-testid=landing-site-details], .contingency-choice",
          ),
        ),
      ).toEqual([]);
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
      await chooseEveryAsset(page);
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
      await openLaunchStep(page);
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with a busy Program, every Asset and every Development chosen", async ({
      page,
    }) => {
      await openBusyProgram(page, { colossusBuilt: true });
      await chooseEveryAsset(page);
      const developments = page.getByRole("checkbox", {
        name: "Start Development",
      });
      await expect(developments.first()).toBeVisible();
      for (const development of await developments.all()) {
        await development.check();
      }
      await expect(page.getByTestId("development-cost")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with notes that nothing is left to Survey", async ({
      page,
    }) => {
      await openBusyProgram(page, { allSurveyed: true, colossusBuilt: true });
      await chooseEveryAsset(page);
      await expect(page.getByTestId("nothing-left-to-survey")).toHaveCount(2);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("the Program summary fits on one screen with every Milestone earned", async ({
      page,
    }) => {
      // Cancelled at the end of the Turn, as nothing else ends a Program now.
      await overrideProgramData(page, { cancellationLevel: 1000 });
      await openBusyProgram(page);
      await endTurnWithoutLaunching(page);
      const summary = page.getByTestId("program-summary");
      await expect(summary.getByRole("listitem")).toHaveCount(
        realMilestones.length,
      );
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Start a new Program" }),
      ).toBeInViewport({ ratio: 1 });
    });
  });
}
