import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  openLoadDialog,
  openSaveDialog,
  viewButton,
} from "./helpers";
import { onOneLine, screenSizes, whatScrolls } from "./layoutHelpers";
import { successSeed } from "./seeds";

// The screens other than Planning Mode, at every supported size. Planning Mode's own are in layout.spec.ts.
for (const size of screenSizes) {
  const sizeName = `${size.width}×${size.height}`;

  test.describe(`at ${sizeName}`, () => {
    test.use({ viewport: size });

    test("the opening screen fits, with a Program to continue and a Save Slot used", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await openSaveDialog(page);
      await page
        .getByTestId("save-slot-1")
        .getByRole("button", { name: "Save here" })
        .click();
      await page.reload();
      const screen = page.getByTestId("opening-screen");
      await expect(screen.getByTestId("save-slot-1")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of [
        "Continue this Program",
        "Start a new Program",
        "Load…",
      ]) {
        await expect(screen.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("the Save and Load dialogs fit on screen, in Planning Mode and on the opening screen", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await openSaveDialog(page);
      const save = page.getByRole("dialog", { name: "Save to a Save Slot" });
      await expect(save).toBeInViewport({ ratio: 1 });
      expect(await whatScrolls(page)).toEqual([]);
      await save
        .getByTestId("save-slot-1")
        .getByRole("button", { name: "Save here" })
        .click();

      await openLoadDialog(page);
      const load = page.getByRole("dialog", { name: "Load from a Save Slot" });
      await expect(load).toBeInViewport({ ratio: 1 });
      expect(await whatScrolls(page)).toEqual([]);

      await page.reload();
      await page.getByRole("button", { name: "Load…" }).click();
      await expect(load).toBeInViewport({ ratio: 1 });
      expect(await whatScrolls(page)).toEqual([]);
    });

    test("Mission Mode's controls fit on one line", async ({ page }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
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
      await expect(
        page.getByRole("button", { name: "End Turn", exact: true }),
      ).toBeInViewport({ ratio: 1 });
      expect(await whatScrolls(page)).toEqual([]);
    });

    test("the Turn summary fits on one screen after a Mission", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
      await page.getByRole("button", { name: "Launch Mission" }).click();
      await page.getByRole("button", { name: "10x" }).click();
      const summary = page.getByTestId("turn-summary");
      await expect(summary).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      await expect(
        summary.getByRole("button", { name: "Continue" }),
      ).toBeInViewport({ ratio: 1 });
    });

    test("text is the same size whatever the screen", async ({ page }) => {
      await page.goto(`/?seed=${successSeed}`);
      await chooseAssets(page, ["Pathfinder Orbiter"]);
      await expect(page.locator("html")).toHaveCSS("font-size", "18px");
    });
  });
}
