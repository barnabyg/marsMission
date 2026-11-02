import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  holdTurnWhenShown,
  pauseAtEvent,
  watchForProblems,
} from "./helpers";
import { freeReturnSeed } from "./seeds";

function trajectory(page: Page) {
  return page.getByRole("combobox", { name: "Trajectory" });
}

test("Free-return is offered only for a Mission with Mars orbit insertion, and stops being chosen if it goes", async ({
  page,
}) => {
  await page.goto(`/?seed=${freeReturnSeed}`);
  await trajectory(page).selectOption("free-return");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.03B");
  await expect(page.getByTestId("mission-mass")).toHaveText(
    "2.5 of 3.8 tonnes",
  );

  await chooseAssets(page, ["Prospector Lander"]);
  await expect(
    trajectory(page).locator("option", { hasText: "Free-return" }),
  ).toHaveCount(0);
  await expect(trajectory(page)).toHaveValue("slow");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeEnabled();
});

test("a Free-return Mission whose arrival burn fails comes back, at no Public Support and with a refund", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the arrival burn to fail, then again for the Mission to get back to Earth.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${freeReturnSeed}`);
  await trajectory(page).selectOption("free-return");

  await pauseAtEvent(page, "Mars orbit insertion failed", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  const failed = page
    .getByTestId("event-entry")
    .filter({ hasText: "Mars orbit insertion failed" });
  await expect(failed).toContainText("swung back");
  await expect(failed).toContainText("It costs no Public Support");
  await expect(failed).toContainText("refunds $350M");
  await expect(page.getByTestId("current-view")).toHaveText("Solar system");
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Pathfinder Orbiter: heading back to Earth",
  );
  await expect(page.getByTestId("returning-spacecraft")).toHaveText(
    "Pathfinder Orbiter: heading back",
  );
  const label = page.getByTestId("returning-spacecraft");
  const place = () => label.evaluate((element) => element.style.transform);
  await expect.poll(place).not.toBe("");
  const placeAtTheBurn = await place();

  await holdTurnWhenShown(page, "Mission back at Earth");
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect
    .poll(place, { message: "The Mission should move on its way home" })
    .not.toBe(placeAtTheBurn);
  await expect(
    page.getByRole("heading", { name: "Mission back at Earth" }),
  ).toBeVisible();
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Pathfinder Orbiter: back at Earth",
  );

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("summary-failure");
  await expect(summary).toContainText("Mission came back to Earth");
  await expect(summary).toContainText("Public Support lost: 0");
  await expect(summary).toContainText("Refund: $350M");
  await expect(summary).toContainText(
    "Assets back on Earth: Pathfinder Orbiter",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  // $2.3B, less $1.03B for the Mission, plus the $350M refund.
  await expect(page.getByTestId("money")).toHaveText("$1.62B");
  expect(problems).toEqual([]);
});

test("a Contingency's Decision Point comes before the Free-return", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the Decision Point at the arrival burn, then ends the Turn.
  await page.goto(`/?seed=${freeReturnSeed}`);
  await trajectory(page).selectOption("free-return");
  await page.getByRole("checkbox", { name: /Reserve fuel/ }).check();
  await page.getByRole("button", { name: "Launch Mission" }).click();

  const decision = page.getByTestId("decision-point");
  await expect(decision).toContainText("swing back to Earth");
  await expect(decision).toContainText("no Public Support");
  await expect(page.getByTestId("returning-spacecraft")).toHaveCount(0);
  await decision.getByRole("button", { name: "Don't use it" }).click();

  await expect(
    page.getByRole("heading", { name: "Mars orbit insertion failed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("summary-failure");
  await expect(summary).toContainText("Public Support lost: 0");
  await expect(summary).toContainText("Refund: $350M");
});
