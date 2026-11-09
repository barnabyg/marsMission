import { expect, test, type Page } from "@playwright/test";
import {
  openLoadDialog,
  openSaveDialog,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { endTurnWithoutLaunching } from "./turnHelpers";
import { successSeed } from "./seeds";

const offer = (page: Page) => page.getByTestId("tutorial-offer");
const panel = (page: Page) => page.getByTestId("tutorial-panel");

async function turnOn(page: Page): Promise<void> {
  await offer(page)
    .getByRole("button", { name: "Turn on Tutorial mode" })
    .click();
  await expect(panel(page)).toBeVisible();
}

/** Turns it off from where the page is, saying yes when asked whether that is for good. */
async function turnOffForGood(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Turn off Tutorial mode" }).click();
  const dialog = page.getByRole("dialog", { name: "Turn off Tutorial mode" });
  await expect(dialog).toContainText("can't be turned on again");
  await dialog.getByRole("button", { name: "Yes, turn it off" }).click();
}

test("offers Tutorial mode as a Program starts, off unless chosen, and keeps the choice through a reload", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await expect(offer(page)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Still offered on the first Turn after a reload, before the player has answered it.
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(offer(page)).toBeVisible();

  await turnOn(page);
  await expect(offer(page)).toHaveCount(0);

  // Turning it off on the first Turn can be undone, so it doesn't ask.
  await panel(page)
    .getByRole("button", { name: "Turn off Tutorial mode" })
    .click();
  await expect(offer(page)).toBeVisible();
  await turnOn(page);

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(panel(page)).toBeVisible();
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(panel(page)).toBeVisible();
  expect(problems).toEqual([]);
});

test("offers Tutorial mode only on a Program's first Turn, and again after Restart Program", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(offer(page)).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Restart Program" }).click();
  await page.getByRole("button", { name: "Yes, start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await turnOn(page);
  await endTurnWithoutLaunching(page);
  await expect(panel(page)).toBeVisible();
  expect(problems).toEqual([]);
});

test("turns Tutorial mode off for good in Planning Mode after the first Turn, and it stays off in the automatic save while a Save Slot keeps it on", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await turnOn(page);
  await openSaveDialog(page);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Save here" })
    .click();
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  // After the first Turn it can't be turned on again, so it asks.
  await turnOffForGood(page);
  await expect(panel(page)).toHaveCount(0);
  await expect(offer(page)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(panel(page)).toHaveCount(0);
  await expect(offer(page)).toHaveCount(0);

  // Still on in the slot saved on Turn 1.
  await openLoadDialog(page);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Load" })
    .click();
  await page.getByRole("button", { name: "Yes, load it" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(panel(page)).toBeVisible();
  expect(problems).toEqual([]);
});

test("turns Tutorial mode off in Mission Mode, and it stays off in the next Planning Mode and after a reload", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await turnOn(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  const inMission = page.getByTestId("mission-tutorial");
  await expect(inMission).toContainText("Tutorial mode is on");

  await inMission
    .getByRole("button", { name: "Turn off Tutorial mode" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Turn off Tutorial mode" });
  await dialog.getByRole("button", { name: "Keep it on" }).click();
  await expect(inMission).toBeVisible();
  await turnOffForGood(page);
  await expect(inMission).toHaveCount(0);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(panel(page)).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(panel(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("gives every tutorial block in Planning and Mission Mode the tutorial's own style, and leaves none once it is off", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const styled = page.locator(".tutorial-voice");
  await page.goto(`/?seed=${successSeed}`);
  // Only offering it is the game asking, not the tutorial speaking.
  await expect(offer(page)).toBeVisible();
  await expect(styled).toHaveCount(0);

  await turnOn(page);
  await expect(panel(page)).toHaveClass(/\btutorial-voice\b/);
  await expect(styled).toHaveCount(1);

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  const inMission = page.getByTestId("mission-tutorial");
  await expect(inMission).toHaveClass(/\btutorial-voice\b/);
  await expect(styled).toHaveCount(1);

  await turnOffForGood(page);
  await expect(styled).toHaveCount(0);
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(styled).toHaveCount(0);
  expect(problems).toEqual([]);
});
