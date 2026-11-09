import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { pinpointLandingSeed } from "./seeds";

test.use({ viewport: missionViewport });

function pinpointRow(page: Page) {
  return page.locator(".asset-choice", { hasText: "Pinpoint Lander" });
}

function landingRiskBand(page: Page) {
  return page
    .getByTestId("mission-event")
    .filter({ hasText: "Entry/descent/landing" })
    .getByTestId("risk-band");
}

test("flies the unproven Pinpoint Lander, sees it become Flight-proven, and plans with its lower cost and risk", async ({
  page,
}) => {
  // Over 5 s: plays to the landing, then on to the next Turn.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${pinpointLandingSeed}`);
  // Read before ticking, as the Launch Vehicle step folds to one line once something is ticked.
  await expect(page.getByTestId("launch-vehicle-readiness")).toHaveText(
    "Flight-proven",
  );
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  // Flight-proven is the usual case, so a card says nothing about it; its details do.
  await expect(
    page.locator(".asset-choice", { hasText: "Prospector Lander" }),
  ).not.toContainText("Flight-proven");
  await expect(pinpointRow(page).getByTestId("asset-cost")).toHaveText("$1.1B");
  await expect(
    pinpointRow(page).getByTestId("technology-readiness"),
  ).toHaveText("Unproven");

  await chooseAssets(page, ["Pinpoint Lander"]);
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.4B");
  // Half the landing risk, but one and a half times that until it is Flight-proven, as is the chance of failing in service.
  await expect(landingRiskBand(page)).toHaveText("Over 30%");
  await expect(page.getByTestId("asset-risk-band")).toHaveText("~20% per Turn");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Pinpoint Lander is Flight-proven",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "5x",
  );
  await expect(
    eventEntries(page).filter({ hasText: "Pinpoint Lander is Flight-proven" }),
  ).toContainText("From the next Turn on, it costs $900M");
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("summary-flight-proven")).toHaveText(
    "Now Flight-proven: Pinpoint Lander",
  );
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(pinpointRow(page).getByTestId("asset-cost")).toHaveText("$900M");
  await expect(
    pinpointRow(page).getByTestId("technology-readiness"),
  ).toHaveCount(0);
  await pinpointRow(page)
    .getByRole("button", { name: "About Pinpoint Lander" })
    .click();
  await expect(page.getByTestId("detail-readiness")).toHaveText(
    "Flight-proven",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await chooseAssets(page, ["Pinpoint Lander"]);
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.2B");
  await expect(landingRiskBand(page)).toHaveText("~20%");
  await expect(page.getByTestId("asset-risk-band")).toHaveText("~10% per Turn");
  expect(problems).toEqual([]);
});

function enduranceRow(page: Page) {
  return page.locator(".asset-choice", { hasText: "Endurance Rover" });
}

function enduranceDevelopment(page: Page) {
  return page.getByTestId("development").filter({ hasText: "Endurance Rover" });
}

test("develops the Endurance Rover over two Turns, then chooses it for a Mission, unproven", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Enough for the Development and then the rover, which a real Program can't afford until later.
  await overrideProgramData(page, { startingMoneyMillions: 4000 });
  await page.goto("/?seed=1");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(
    enduranceRow(page).getByTestId("technology-readiness"),
  ).toHaveText("Needs Development");
  await expect(enduranceRow(page).getByRole("checkbox")).toBeDisabled();
  await expect(enduranceDevelopment(page)).toContainText(
    "Endurance Rover ($1.2B, 2 Turns)",
  );
  await enduranceDevelopment(page)
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  // Paid this Turn alongside the Mission, so both count against the money.
  await expect(page.getByTestId("development-cost")).toHaveText("$1.2B");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("summary-development-started")).toHaveText(
    "Development started: Endurance Rover",
  );
  await expect(page.getByTestId("summary-development-cost")).toHaveText(
    "$1.2B",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("money")).toHaveText("$3B");
  await expect(
    enduranceDevelopment(page).getByTestId("development-progress"),
  ).toHaveText("In Development: 1 Turn left");
  await expect(enduranceDevelopment(page).getByRole("checkbox")).toHaveCount(0);
  await expect(enduranceRow(page).getByRole("checkbox")).toBeDisabled();
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("summary-development-finished")).toContainText(
    "Endurance Rover",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(
    enduranceDevelopment(page).getByTestId("development-progress"),
  ).toHaveText("Developed: can be chosen for a Mission");
  await expect(
    enduranceRow(page).getByTestId("technology-readiness"),
  ).toHaveText("Unproven");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await chooseAssets(page, ["Endurance Rover"]);
  // Its unproven cost and the Launch Vehicle's.
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.7B");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  expect(problems).toEqual([]);
});
