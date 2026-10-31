import { expect, test, type Page } from "@playwright/test";
import {
  eventEntries,
  pauseAtEvent,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { crashSeed, landingSeed } from "./seeds";

async function planLanding(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByLabel("Asset").selectOption("prospector-lander");
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
  await page.getByLabel("Asset").selectOption("prospector-lander");
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "landing again earns no Science",
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
