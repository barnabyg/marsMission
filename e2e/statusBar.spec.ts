import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

async function playTurnWithoutLaunching(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
}

test("the Public Support gauge turns amber when Public Support is close to the Cancellation Level", async ({
  page,
}) => {
  await overrideProgramData(page, {
    startingPublicSupport: 100,
    cancellationLevel: 70,
  });
  await page.goto("/");

  const gauge = page.getByTestId("support-gauge");
  await expect(gauge).toHaveClass(/warning/);
  // Amber: the --warning colour, #ffb547.
  await expect(page.getByTestId("public-support")).toHaveCSS(
    "color",
    "rgb(255, 181, 71)",
  );
  await expect(gauge).toContainText("Close to the Cancellation Level of 70");
  await expect(page.getByTestId("public-support")).toHaveText("100");
});

test("Planning Mode shows how each value changed over the last Turn, and nothing on the first", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto("/");
  const gauge = page.getByTestId("support-gauge");
  await expect(gauge).not.toHaveClass(/warning/);
  await expect(gauge).toContainText("Cancellation Level 50");
  await expect(page.locator(".status-change")).toHaveCount(0);

  await playTurnWithoutLaunching(page);

  // With no Mission and nothing at Mars, only the fading of Public Support changes anything.
  await expect(page.getByTestId("public-support")).toHaveText("85");
  await expect(page.getByTestId("public-support-change")).toHaveText("−15");
  await expect(page.locator(".status-change")).toHaveCount(1);
  expect(problems).toEqual([]);
});

test("shows what the Turn will spend beside the Money, and what it leaves, as choices change", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const spend = page.getByTestId("turn-spend");
  const amount = page.getByTestId("turn-spend-amount");
  const left = page.getByTestId("turn-spend-left");

  // Nothing ticked, so ending the Turn without launching spends nothing.
  await expect(amount).toHaveText("$0M");
  await expect(left).toHaveText("$2.3B left");
  await expect(spend).toHaveClass(/within/);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // The Pathfinder Orbiter and its Launch Vehicle.
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(amount).toHaveText("$1B");
  await expect(left).toHaveText("$1.3B left");

  // Within a tenth of the Money is near it, in amber, as on the budget bar.
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  await expect(amount).toHaveText("$2.2B");
  await expect(spend).toHaveClass(/near/);
  await expect(left).toHaveCSS("color", "rgb(255, 181, 71)");

  // Over the Money, in red, saying by how much.
  await page
    .getByRole("combobox", { name: "Reliability for Launch" })
    .selectOption("redundant");
  await expect(spend).toHaveClass(/over/);
  await expect(left).toHaveText("$50M over");
  await expect(amount).toHaveCSS("color", "rgb(255, 143, 122)");
  expect(problems).toEqual([]);
});
