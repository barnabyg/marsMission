import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { termsWithoutTooltips, watchForProblems } from "./helpers";
import { saveToSlot } from "./saveHelpers";
import { successSeed } from "./seeds";

test("shows the game's name over Mars, with Continue first and no Save Slots when none is used", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  const backdrop = page.waitForResponse("**/art/mars.jpg");
  await page.reload();

  const screen = page.getByTestId("opening-screen");
  await expect(
    screen.getByRole("heading", { level: 1, name: "Mars Mission" }),
  ).toBeVisible();
  expect((await backdrop).ok()).toBe(true);
  await expect(screen).toHaveCSS("background-image", /art\/mars\.jpg/);

  const buttons = screen.getByRole("button");
  await expect(buttons).toHaveText([
    "Continue this Program",
    "Start a new Program",
  ]);
  await expect(buttons.first()).toHaveClass(/primary/);
  await expect(screen.getByRole("heading", { name: "Save Slots" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId(/^save-slot-/)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await buttons.first().click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  expect(problems).toEqual([]);
});

test("lists only the used Save Slots, with Turn, Launch Window and Money, and loads the one chosen", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const money = (await page.getByTestId("money").textContent()) ?? "";
  await saveToSlot(page, 2);
  // With no automatic save, as after a Program that was cancelled.
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, storageKeyFor("automatic"));
  await page.reload();

  const screen = page.getByTestId("opening-screen");
  await expect(
    screen.getByRole("button", { name: "Continue this Program" }),
  ).toHaveCount(0);
  await expect(
    screen.getByRole("heading", { name: "Save Slots" }),
  ).toBeVisible();
  const slot = screen.getByTestId("save-slot-2");
  await expect(slot).toContainText("Save Slot 2");
  await expect(slot).toContainText("Turn 1");
  await expect(slot).toContainText("December 2028 Launch Window");
  await expect(slot).toContainText(money);
  await expect(screen.getByTestId("save-slot-1")).toHaveCount(0);
  await expect(screen.getByTestId("save-slot-3")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Each slot's own Load is the one way to load: no Load… beside Start a new Program.
  await expect(screen.getByRole("button", { name: "Load…" })).toHaveCount(0);
  // With no automatic save to lose, it loads straight away.
  await slot.getByRole("button", { name: "Load" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  expect(problems).toEqual([]);
});
