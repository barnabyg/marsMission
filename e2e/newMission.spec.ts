import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

function launchMission(page: Page) {
  return page.getByRole("button", { name: "Launch Mission" });
}

/** Planning Mode with no Asset ticked: Launch Mission waits for one, with a hint rather than an error. */
async function expectNothingTicked(page: Page) {
  for (const box of await page
    .locator(".asset-choice")
    .getByRole("checkbox")
    .all()) {
    await expect(box).not.toBeChecked();
  }
  await expect(page.getByTestId("nothing-ticked")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(launchMission(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "End Turn without launching" }),
  ).toBeEnabled();
}

test("starts each Turn's New Mission with nothing ticked, and tags an Asset already at Mars", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expectNothingTicked(page);
  await expect(page.getByTestId("operating-tag")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("nothing-ticked")).toHaveCount(0);
  await launchMission(page).click();
  await playToNextTurn(page);

  // The orbiter at Mars keeps working, so the New Mission doesn't start with another ticked.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  await expectNothingTicked(page);
  const atMars = page
    .locator(".asset-choice", { hasText: "Pathfinder Orbiter" })
    .getByTestId("operating-tag");
  await expect(atMars).toHaveText("1 at Mars");
  await expect(page.getByTestId("operating-tag")).toHaveCount(1);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await atMars.hover();
  await expect(page.getByTestId("tooltip-detail")).toHaveText(
    "Pathfinder Orbiter operating at Mars: 1. Each keeps working without being launched again, so ticking this launches another.",
  );
  expect(problems).toEqual([]);
});
