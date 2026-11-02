import { expect, test, type Page } from "@playwright/test";
import {
  eventEntries,
  pauseAtEvent,
  viewButton,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

function trajectory(page: Page) {
  return page.getByRole("combobox", { name: "Trajectory" });
}

/** Flies the first orbiter by this Trajectory, and returns the date of its arrival in the events column. */
async function arrivalDate(page: Page, id: "slow" | "fast"): Promise<string> {
  await page.goto(`/?seed=${successSeed}`);
  await trajectory(page).selectOption(id);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await expect(page.getByTestId("operating-at-mars")).toContainText(
    "Pathfinder Orbiter",
  );
  return eventEntries(page)
    .filter({ hasText: "Mars orbit insertion" })
    .locator("time")
    .innerText();
}

test("Planning Mode shows what a Trajectory changes", async ({ page }) => {
  await page.goto(`/?seed=${successSeed}`);
  await expect(trajectory(page).locator("option")).toHaveText([
    "Slow (210 days)",
    "Fast (150 days, $40M, 0.5 t less)",
    "Free-return (210 days, $30M, 0.2 t less)",
  ]);
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("mission-mass")).toHaveText("2.5 of 4 tonnes");
  await expect(page.getByTestId("trajectory-details")).toContainText(
    "least fuel",
  );

  await trajectory(page).selectOption("fast");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.04B");
  await expect(page.getByTestId("mission-mass")).toHaveText(
    "2.5 of 3.5 tonnes",
  );
  await expect(page.getByTestId("trajectory-details")).toContainText(
    "arrive sooner",
  );
});

test("a Fast Mission arrives earlier than a Slow one, with more research", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const slow = await arrivalDate(page, "slow");
  await page.evaluate(() => {
    localStorage.clear();
  });
  const fast = await arrivalDate(page, "fast");
  expect(Date.parse(fast)).toBeLessThan(Date.parse(slow));
  // 60 days sooner, whichever month that lands in.
  expect(Date.parse(slow) - Date.parse(fast)).toBe(60 * 86_400_000);
  await viewButton(page, "Solar system").click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("turn-summary")).toContainText("Mission cost");
  expect(problems).toEqual([]);
});

test("a Trajectory too heavy for the Launch Vehicle is refused", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("checkbox", { name: /Pathfinder Orbiter/ }).uncheck();
  await page.getByRole("checkbox", { name: /Trailblazer Rover/ }).check();
  await page.getByRole("checkbox", { name: /Retro thrusters/ }).check();
  await trajectory(page).selectOption("fast");
  await expect(page.getByRole("alert").first()).toContainText("3.5 tonnes");
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeDisabled();
});
