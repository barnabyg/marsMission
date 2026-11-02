import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { pinpointLandingSeed } from "./seeds";

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
  // Over 5 s: waits at 1x for the landing, then plays on to the next Turn.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${pinpointLandingSeed}`);
  await expect(page.getByTestId("launch-vehicle-readiness")).toHaveText(
    "Flight-proven",
  );
  await expect(
    page.locator(".asset-choice", { hasText: "Prospector Lander" }),
  ).toContainText("Flight-proven");
  await expect(pinpointRow(page)).toContainText("Pinpoint Lander ($1.3B, 3 t)");
  await expect(
    pinpointRow(page).getByTestId("technology-readiness"),
  ).toHaveText("Unproven");

  await chooseAssets(page, ["Pinpoint Lander"]);
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.6B");
  // Half the landing risk, but twice that until it is Flight-proven, and twice the chance of failing in service.
  await expect(landingRiskBand(page)).toHaveText("Over 30%");
  await expect(pinpointRow(page).getByTestId("asset-risk-band")).toHaveText(
    "~20% per Turn",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(page, "Pinpoint Lander is Flight-proven", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await expect(
    eventEntries(page).filter({ hasText: "Pinpoint Lander is Flight-proven" }),
  ).toContainText("From the next Turn on, it costs $1B");
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-flight-proven")).toHaveText(
    "Now Flight-proven: Pinpoint Lander",
  );
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(pinpointRow(page)).toContainText("Pinpoint Lander ($1B, 3 t)");
  await expect(
    pinpointRow(page).getByTestId("technology-readiness"),
  ).toHaveText("Flight-proven");
  await chooseAssets(page, ["Pinpoint Lander"]);
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.3B");
  await expect(landingRiskBand(page)).toHaveText("~20%");
  await expect(pinpointRow(page).getByTestId("asset-risk-band")).toHaveText(
    "~10% per Turn",
  );
  expect(problems).toEqual([]);
});
