import { expect, test, type Page } from "@playwright/test";
import {
  eventEntries,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

function viewButton(page: Page, name: "Solar system" | "Mars orbit") {
  return page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });
}

function orbiterLabels(page: Page) {
  return page.getByTestId("mars-orbit-asset");
}

async function launchFirstMission(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
}

test("switches to the Mars orbit view and back during a Turn, at any speed and while paused", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  const current = page.getByTestId("current-view");
  const speed = page.getByTestId("current-speed");
  await expect(current).toHaveText("Solar system");
  await expect(viewButton(page, "Solar system")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".view-label", { hasText: "Earth" })).toBeVisible();

  // While playing, which leaves the speed alone.
  await page.getByRole("button", { name: "5x" }).click();
  await viewButton(page, "Mars orbit").click();
  await expect(current).toHaveText("Mars orbit");
  await expect(viewButton(page, "Mars orbit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(viewButton(page, "Solar system")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(speed).toHaveText("5x");
  await expect(page.locator(".view-label", { hasText: "Earth" })).toHaveCount(
    0,
  );

  // While paused, which holds the date and the events column.
  await page.getByRole("button", { name: "Pause" }).click();
  const date = await page.getByTestId("mission-date").textContent();
  const happened = await eventEntries(page).count();
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await viewButton(page, "Mars orbit").click();
  await expect(current).toHaveText("Mars orbit");
  await expect(speed).toHaveText("Paused");
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");
  expect(await eventEntries(page).count()).toBe(happened);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // At top speed, and the Turn still runs to its end.
  await page.getByRole("button", { name: "10x" }).click();
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("shows an orbiter going round Mars from the day it arrives, only in the Mars orbit view", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  await pauseAtEvent(page, "Launch");
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(0);

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  await expect(orbiterLabels(page)).toBeVisible();

  await viewButton(page, "Solar system").click();
  await expect(orbiterLabels(page)).toHaveCount(0);
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(1);

  // It's still there next Turn, from the first day.
  await page.getByRole("button", { name: "10x" }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  expect(problems).toEqual([]);
});

test("never shows an orbiter whose Mission failed", async ({ page }) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, seedFailingAt("Mars orbit insertion"));
  await viewButton(page, "Mars orbit").click();

  await pauseAtEvent(page, "Mars orbit insertion failed");
  await expect(orbiterLabels(page)).toHaveCount(0);
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing yet");

  await page.getByRole("button", { name: "5x" }).click();
  await expect
    .poll(async () => {
      const summary = await page.getByTestId("turn-summary").count();
      const orbiters = await orbiterLabels(page).count();
      expect(orbiters).toBe(0);
      return summary;
    })
    .toBe(1);
  expect(problems).toEqual([]);
});

/** Plays the first Mission to its Turn summary, leaving the view alone unless told to keep switching. */
async function summaryAfterFirstTurn(
  page: Page,
  seed: number,
  keepSwitching: boolean,
): Promise<string> {
  await launchFirstMission(page, seed);
  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  let next: "Mars orbit" | "Solar system" = "Mars orbit";
  while (keepSwitching && (await summary.count()) === 0) {
    // The Turn may end before the click lands, which is fine.
    await viewButton(page, next)
      .click({ timeout: 500 })
      .catch(() => undefined);
    next = next === "Mars orbit" ? "Solar system" : "Mars orbit";
  }
  await expect(summary).toBeVisible();
  return (await summary.textContent()) ?? "";
}

test("gives the same results whichever view is showing", async ({ page }) => {
  const untouched = await summaryAfterFirstTurn(page, successSeed, false);
  await page.evaluate(() => {
    localStorage.clear();
  });
  const switched = await summaryAfterFirstTurn(page, successSeed, true);
  expect(untouched).toContain("First orbiter at Mars");
  expect(switched).toBe(untouched);
});

for (const size of [
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
]) {
  test(`keeps the view buttons on the one line of controls at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await launchFirstMission(page, successSeed);
    const bar = await page.locator(".mission-bar").boundingBox();
    const middle = (bar?.y ?? 0) + (bar?.height ?? 0) / 2;
    for (const control of [
      page.getByRole("heading", { name: "Mission Mode" }),
      viewButton(page, "Solar system"),
      viewButton(page, "Mars orbit"),
      page.getByRole("button", { name: "10x" }),
    ]) {
      const box = await control.boundingBox();
      expect(
        Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - middle),
      ).toBeLessThan(10);
    }
    const progress = await page
      .getByRole("progressbar", { name: "Progress through the Turn" })
      .boundingBox();
    expect(progress?.width).toBeGreaterThan(100);
  });
}
