import { expect, test, type Page } from "@playwright/test";
import {
  listenForSounds,
  missionViewport,
  soundsHeard,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { eventEntries, pauseAtEvent } from "./playbackHelpers";
import { overrideProgramData } from "./saveHelpers";
import { endTurnWithoutLaunching } from "./turnHelpers";
import { openLaunchStep, chooseAssets } from "./planningHelpers";
import { colossusMoney, colossusSeed } from "./colossusSeeds";

test.use({ viewport: missionViewport });

function colossusDevelopment(page: Page) {
  return page
    .getByTestId("development")
    .filter({ hasText: "Meridian Colossus" });
}

function launchVehicle(page: Page) {
  return page.getByRole("combobox", { name: "Launch Vehicle" });
}

test("develops the Meridian Colossus, then fills it with more than any other Launch Vehicle carries and sees it refuel on the way", async ({
  page,
}) => {
  // Over 5 s: two Turns of Development, then a Turn played at 10x.
  const problems = watchForProblems(page);
  await listenForSounds(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await page.goto(`/?seed=${colossusSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await openLaunchStep(page);
  await expect(
    launchVehicle(page).locator("option", { hasText: "Meridian Colossus" }),
  ).toHaveJSProperty("disabled", true);
  await expect(colossusDevelopment(page)).toContainText(
    "Meridian Colossus ($1.2B, 2 Turns)",
  );
  await colossusDevelopment(page)
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await endTurnWithoutLaunching(page);

  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(
    colossusDevelopment(page).getByTestId("development-progress"),
  ).toHaveText("Developed: can be chosen for a Mission");
  await launchVehicle(page).selectOption("meridian-colossus");
  await expect(page.getByTestId("launch-vehicle-readiness")).toHaveText(
    "Unproven",
  );
  // The tag beside the choice says it, so the chosen option doesn't as well.
  await expect(launchVehicle(page).locator("option:checked")).not.toContainText(
    "Unproven",
  );
  await chooseAssets(page, [
    "Pathfinder Orbiter",
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  // Too much for Meridian Heavy, at 8 tonnes.
  await expect(page.getByTestId("mission-mass")).toHaveText("9 of 16 tonnes");
  await expect(page.getByTestId("mission-event")).toHaveText([
    /^Launch/,
    /^Tanker launch/,
    /^Rendezvous/,
    /^Mars transfer burn/,
    /^Mars orbit insertion/,
    /^Entry\/descent\/landing/,
  ]);
  const rendezvousBand = page
    .getByTestId("mission-event")
    .filter({ hasText: "Rendezvous" })
    .getByTestId("risk-band");
  // Raised while the Launch Vehicle is unproven, and lowered by Reliability.
  await expect(rendezvousBand).toHaveText("~10%");
  await page
    .getByRole("combobox", { name: "Reliability for Rendezvous" })
    .selectOption("redundant");
  await expect(rendezvousBand).toHaveText("~2%");
  await page
    .getByRole("combobox", { name: "Reliability for Rendezvous" })
    .selectOption("none");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await pauseAtEvent(page, "Meridian Colossus is Flight-proven", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  // Newest first, each on its own day, with the Flight-proven entry on the day of the Mars transfer burn.
  await expect(eventEntries(page).getByRole("heading")).toHaveText([
    "Meridian Colossus is Flight-proven",
    "Mars transfer burn",
    "Rendezvous",
    "Tanker launch",
    "Launch",
  ]);
  await expect(
    eventEntries(page).filter({ hasText: "Tanker launch" }),
  ).toContainText("Orbital refuelling");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect((await soundsHeard(page)).map(([file]) => file)).toEqual([
    "launch.wav",
    "launch.wav",
    "rendezvous.wav",
  ]);
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-flight-proven")).toHaveText(
    "Now Flight-proven: Meridian Colossus",
  );
  expect(problems).toEqual([]);
});
