import { expect, test, type Page } from "@playwright/test";
import { overrideProgramData, watchForProblems } from "./helpers";

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
