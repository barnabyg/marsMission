import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  endTurnWithoutLaunching,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { screenSizes } from "./layoutHelpers";
import { successSeed } from "./seeds";

const advice = (page: Page) => page.getByTestId("tutorial-advice");

async function startTutorial(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Turn on tutorial mode" }).click();
  await expect(advice(page)).toBeVisible();
}

test("a Tutorial mode Program's first Planning session shows advice with reasons and its stage, and the advice changes after a Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await startTutorial(page, successSeed);
  await expect(page.getByTestId("tutorial-stage")).toContainText(
    "Stage 1 of 6: First orbiter",
  );
  const items = page.getByTestId("tutorial-items").locator("li");
  expect(await items.count()).toBeGreaterThan(0);
  await expect(page.locator(".tutorial-reason").first()).not.toBeEmpty();
  await expect(page.getByTestId("tutorial-change")).toHaveCount(0);
  // Text only: nothing in it fills in the plan.
  await expect(advice(page).getByRole("button")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  const firstAdvice = await advice(page).textContent();

  // Not following it: the next Turn's advice says so first.
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("tutorial-change")).toBeVisible();
  expect(await advice(page).textContent()).not.toEqual(firstAdvice);
  expect(problems).toEqual([]);
});

for (const size of screenSizes) {
  test(`at ${size.width}×${size.height} the advice leaves the plan's controls in view`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await startTutorial(page, successSeed);
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    for (const name of [
      "Launch Mission",
      "End Turn without launching",
      "Turn off tutorial mode",
    ]) {
      await expect(page.getByRole("button", { name })).toBeInViewport({
        ratio: 1,
      });
    }
    const pageScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight > innerHeight ||
        document.documentElement.scrollWidth > innerWidth,
    );
    expect(pageScrolls).toBe(false);
  });
}
