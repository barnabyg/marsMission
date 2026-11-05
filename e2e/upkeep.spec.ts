import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  endTurnAndContinue,
  endTurnWithoutLaunching,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

test("pays Upkeep for an Asset kept at Mars, shown before the Turn and in its summary, until its mission is ended", async ({
  page,
}) => {
  // Over 5 s: plays a Turn at 10x, then two more.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  // Its longest Service Life, so that it is still operating on Turn 3.
  const life = page.getByLabel("Service Life for Pathfinder Orbiter");
  const longest = await life.locator("option").last().getAttribute("value");
  await life.selectOption(longest ?? "");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  // The orbiter costs Upkeep from the Turn after it arrives, which the Turn will spend even without a launch.
  const row = page
    .getByTestId("operating-assets")
    .getByRole("listitem")
    .filter({ hasText: "Pathfinder Orbiter" });
  await expect(page.getByTestId("operating-upkeep")).toHaveText(
    "Each Asset keeps its Activity until you change it. Upkeep this Turn: $10M.",
  );
  await expect(row.locator(".end-mission")).toHaveAttribute(
    "title",
    "Takes it out of service as this Turn starts, saving its Upkeep of $10M a Turn.",
  );
  await expect(page.getByTestId("turn-spend-amount")).toHaveText("$10M");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("upkeep-cost")).toHaveText("$10M");
  await expect(page.getByTestId("turn-spend-amount")).toHaveText("$1.01B");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await chooseAssets(page, []);

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const spent = page.getByTestId("summary-money-spent");
  await expect(spent.getByRole("listitem")).toHaveText(["Upkeep$10M"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("3");

  // Ending its mission takes it out of service as the Turn starts, so it costs nothing more.
  await row
    .getByRole("checkbox", { name: "End the mission of Pathfinder Orbiter" })
    .check();
  await expect(row).toContainText("its mission ends as this Turn starts");
  await expect(page.getByTestId("turn-spend-amount")).toHaveText("$0M");
  await expect(page.getByTestId("operating-upkeep")).toHaveText(
    "Each Asset keeps its Activity until you change it. Upkeep this Turn: $0M.",
  );
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  await expect(page.getByTestId("operating-assets")).toHaveCount(0);
  expect(problems).toEqual([]);
});
