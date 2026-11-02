import { expect, test } from "@playwright/test";
import { chooseAssets, watchForProblems } from "./helpers";
import { holdOffSeed } from "./seeds";

test("holding off a landing in a dust storm lands it later, with a shorter Service Life", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${holdOffSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const endTurn = page.getByRole("button", { name: "End Turn", exact: true });
  await endTurn.click();

  const panel = page.getByTestId("decision-point");
  await expect(panel).toContainText(
    "Decision Point: Go/no-go check at Jezero Crater",
  );
  await expect(panel).toContainText("Landing: Prospector Lander");
  await expect(page.getByTestId("decision-choice-go")).toContainText(
    "Risk Band",
  );
  await expect(page.getByTestId("decision-choice-holdOff")).toContainText(
    /Land in \d+ days/,
  );
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  await panel.getByRole("button", { name: "Hold off" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Holding off the landing at Jezero Crater",
    }),
  ).toBeVisible();
  await endTurn.click();

  const summary = page.getByTestId("summary-go-no-go");
  await expect(summary).toContainText(
    /Held off the landing at Jezero Crater for \d+ days/,
  );
  const [, daysHeld = "0", lifeLost = "0"] =
    /for (\d+) days.* lost (\d+) days of Service Life/.exec(
      await summary.innerText(),
    ) ?? [];
  expect(Number(daysHeld)).toBeGreaterThan(0);
  // A day and a half of Service Life for each day held.
  expect(Number(lifeLost)).toBe(Math.round(Number(daysHeld) * 1.5));
  await expect(page.getByTestId("summary-first-landing")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  // The shortest Service Life is 1300 days, less what waiting cost, counted from the later landing.
  const left = 1300 - Number(lifeLost) - (780 - 215 - Number(daysHeld));
  await expect(page.getByTestId("operating-assets")).toContainText(
    `${left} days of Service Life left`,
  );
  expect(problems).toEqual([]);
});
