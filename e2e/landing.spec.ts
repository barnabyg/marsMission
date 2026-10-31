import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  pauseAtEvent,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { crashSeed, landingSeed, orbiterSafeSeed } from "./seeds";

async function planLanding(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await chooseAssets(page, ["Prospector Lander"]);
}

function landingRiskBand(page: Page) {
  return page
    .getByTestId("mission-event")
    .filter({ hasText: "Entry/descent/landing" })
    .getByTestId("risk-band");
}

test("plans a landing, plays it through and reaches the next Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await planLanding(page, landingSeed);

  await expect(landingRiskBand(page)).toHaveText("Over 30%");
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "first landing here earns 120 Science",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "First landing at Jezero Crater");
  await expect(
    eventEntries(page).getByRole("heading", { name: "First landing on Mars" }),
  ).toBeVisible();
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Prospector Lander: landed at Jezero Crater",
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Prospector Lander at Jezero Crater",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("science")).toHaveText("270");
  await expect(page.getByTestId("operating-assets")).toHaveText(
    "Prospector Lander at Jezero Crater",
  );
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "landing again earns no Science",
  );
  expect(problems).toEqual([]);
});

test("refuses a too-heavy Mission, then launches an orbiter and a lander together", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterSafeSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);

  await expect(page.getByTestId("mission-mass")).toHaveText("5.5 of 4 tonnes");
  await expect(page.getByRole("alert")).toContainText("weighs 5.5 tonnes");
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeDisabled();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await expect(page.getByTestId("mission-mass")).toHaveText("5.5 of 8 tonnes");
  await expect(page.getByTestId("mission-cost")).toHaveText("$2.2B");
  await expect(page.getByTestId("mission-event")).toHaveCount(4);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await pauseAtEvent(page, "Entry/descent/landing failed");
  const failed = eventEntries(page).first();
  await expect(failed).toContainText(
    "Lost with the Mission: Prospector Lander",
  );
  await expect(failed).toContainText("Still safe: Pathfinder Orbiter");
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Pathfinder Orbiter: arrived at Mars. Prospector Lander: crashed at Jezero Crater",
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter",
  );

  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("summary-failure");
  await expect(summary).toContainText("Assets lost: Prospector Lander");
  await expect(summary).not.toContainText("Pathfinder Orbiter");
  await expect(page.getByTestId("turn-summary")).toContainText(
    "First orbiter at Mars",
  );
  expect(problems).toEqual([]);
});

test("reports a failed landing as a crash at the Landing Site", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await planLanding(page, crashSeed);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await pauseAtEvent(page, "Entry/descent/landing failed");
  const failed = eventEntries(page).first();
  await expect(failed).toHaveClass(/failed/);
  await expect(failed).toContainText("crashed at Jezero Crater");
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Prospector Lander: crashed at Jezero Crater",
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing yet");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Entry/descent/landing",
  );
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Prospector Lander",
  );
  expect(problems).toEqual([]);
});
