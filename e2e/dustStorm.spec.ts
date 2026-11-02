import { expect, test, type Page } from "@playwright/test";
import { chooseAssets, watchForProblems } from "./helpers";
import { dustStormLossSeed, dustStormSeed } from "./seeds";

function decisionPoint(page: Page) {
  return page.getByTestId("decision-point");
}

function endTurn(page: Page) {
  return page.getByRole("button", { name: "End Turn", exact: true });
}

/** Lands a lander at the first Landing Site on Turn 1, and starts Turn 2 with nothing to launch, up to the dust storm. */
async function meetStorm(page: Page, seed: number) {
  await page.goto(`/?seed=${seed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurn(page).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();
}

test("a dust storm stops play with its site, its Assets and its costs, and sheltering shows in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await meetStorm(page, dustStormSeed);

  const panel = decisionPoint(page);
  await expect(panel).toContainText("Dust storm over Jezero Crater");
  await expect(panel).toContainText("Prospector Lander");
  await expect(page.getByTestId("decision-choice-shelter")).toContainText(
    "nothing there earns Ongoing Research",
  );
  await expect(page.getByTestId("decision-choice-carryOn")).toContainText(
    "Risk Band",
  );
  await expect(endTurn(page)).toBeDisabled();

  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("solar-system-view")).toHaveAttribute(
    "data-dust-storm",
    "Jezero Crater",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    /Dust storm: \d+ days left/,
  );

  await panel.getByRole("button", { name: "Shelter" }).click();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Sheltering from the storm at Jezero Crater",
    }),
  ).toBeVisible();

  await endTurn(page).click();
  const storms = page.getByTestId("summary-dust-storms");
  await expect(storms).toContainText(
    /Dust storm over Jezero Crater: Prospector Lander sheltered for \d+ days/,
  );
  await expect(page.getByTestId("summary-ongoing-research")).not.toContainText(
    "over 780 days",
  );
  await expect(page.getByTestId("summary-assets-failed")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("carrying on through a dust storm can lose the Asset, with its entry and the Turn summary saying so", async ({
  page,
}) => {
  await meetStorm(page, dustStormLossSeed);
  await decisionPoint(page).getByRole("button", { name: "Carry on" }).click();
  await endTurn(page).click();

  await expect(page.getByTestId("summary-dust-storms")).toContainText(
    "and lost Prospector Lander",
  );
  await expect(page.getByTestId("summary-assets-failed")).toContainText(
    "Prospector Lander",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(
    page.getByText("Prospector Lander at Jezero Crater"),
  ).toHaveCount(0);
});

test("carrying on through a dust storm keeps every day of research when the Asset comes through", async ({
  page,
}) => {
  await meetStorm(page, dustStormSeed);
  await decisionPoint(page).getByRole("button", { name: "Carry on" }).click();
  await endTurn(page).click();

  await expect(page.getByTestId("summary-dust-storms")).toContainText(
    "came through",
  );
  await expect(page.getByTestId("summary-assets-failed")).toHaveCount(0);
});
