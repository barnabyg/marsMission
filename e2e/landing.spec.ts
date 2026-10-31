import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  holdTurnWhenShown,
  openLoadDialog,
  openSaveDialog,
  pauseAtEvent,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  crashSeed,
  landingSeed,
  orbiterFailsInServiceSeed,
  orbiterLastsSeed,
  orbiterSafeSeed,
  successSeed,
} from "./seeds";

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
  // Over 5 s: waits at 1x for the landing so the pause lands in time, then plays on to the next Turn.
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
    "Prospector Lander at Jezero Crater: Surface research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  // 150 for the Milestone, 120 for the site, and what Surface research earned in the days left.
  await expect(page.getByTestId("science")).toHaveText("314");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Prospector Lander at Jezero Crater: 35 days of Service Life left",
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
  // Over 5 s: waits at 1x for the landing so the pause lands in time, then plays out the Turn.
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
    "Pathfinder Orbiter: Survey",
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

test("surveys for a Turn, then sees a lower Risk Band and a new Landing Site when planning a landing", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the Survey so the pause lands in time, then plays out the Turn.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(landingRiskBand(page)).toHaveText("Over 30%");
  const sites = page.getByLabel("Landing Site").getByRole("option");
  await expect(sites).toHaveCount(2);
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "Not surveyed",
  );

  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Survey from orbit");
  const survey = eventEntries(page).filter({ hasText: "Survey from orbit" });
  await expect(survey).toContainText("29 June 2029");
  await expect(survey).toContainText(
    "A new Landing Site is known: Meridiani Planum",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-survey")).toContainText(
    "Meridiani Planum",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  await chooseAssets(page, ["Prospector Lander"]);
  await expect(landingRiskBand(page)).toHaveText("~10%");
  await expect(sites).toHaveCount(3);
  await expect(sites.last()).toContainText("Meridiani Planum");
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "Surveyed.",
  );
  expect(problems).toEqual([]);
});

test("turns Surveying off, sees no Survey that Turn, keeps that through a reload, and turns it back on", async ({
  page,
}) => {
  // Over 5 s: plays two Turns, because turning Surveying back on needs an Asset already operating.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterLastsSeed}`);
  const activity = page.getByLabel("Activity for Pathfinder Orbiter");
  await expect(activity).toHaveValue("survey");
  await expect(activity.getByRole("option")).toHaveText([
    "Survey",
    "Orbital research",
    "Nothing",
  ]);
  await activity.selectOption("nothing");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter: Nothing",
  );
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  await expect(page.getByTestId("summary-survey")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("2");
  const operating = page.getByTestId("operating-assets");
  const operatingActivity = operating.getByLabel(
    "Activity for Pathfinder Orbiter",
  );
  await expect(operatingActivity).toHaveValue("nothing");

  // Coming back through the automatic save keeps it too.
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(operatingActivity).toHaveValue("nothing");
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(page.getByLabel("Landing Site").getByRole("option")).toHaveCount(
    2,
  );

  await operatingActivity.selectOption("survey");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter: Survey",
  );
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-survey")).toContainText(
    "Meridiani Planum",
  );
  expect(problems).toEqual([]);
});

test("forgets an Activity chosen but not yet carried out when a save is loaded", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterLastsSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);

  await openSaveDialog(page);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Save here" })
    .click();
  const activity = page
    .getByTestId("operating-assets")
    .getByLabel("Activity for Pathfinder Orbiter");
  await activity.selectOption("nothing");

  await openLoadDialog(page);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Load" })
    .click();
  await page.getByRole("button", { name: "Yes, load it" }).click();
  await expect(activity).toHaveValue("survey");
  expect(problems).toEqual([]);
});

test("offers a Service Life for each chosen Asset, which changes the cost, and sees one end during a Turn", async ({
  page,
}) => {
  // Over 5 s: plays two Turns, because a Service Life can only run out in the Turn after the launch.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterLastsSeed}`);
  const life = page.getByLabel("Service Life for Pathfinder Orbiter");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await life.selectOption("1700");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.15B");
  await life.selectOption("900");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter: 330 days of Service Life left",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // At the 10x carried over, the Service Life ends about 0.5 s into this Turn.
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter: Survey",
  );
  const ended = "Pathfinder Orbiter: Service Life ended";
  await holdTurnWhenShown(page, ended);
  await page.getByRole("button", { name: "10x" }).click();
  await expect(eventEntries(page).first().getByRole("heading")).toHaveText(
    ended,
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  await expect(eventEntries(page).first()).toContainText(
    "costs no Public Support",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-assets-ended")).toContainText(
    "Pathfinder Orbiter",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("operating-assets")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("buys Reliability for an Asset, then sees one fail in service with a known seed", async ({
  page,
}) => {
  // Over 5 s: plays two Turns, because an Asset can only fail in service in the Turn after the launch.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterFailsInServiceSeed}`);

  const reliability = page.getByLabel(
    "Reliability for Pathfinder Orbiter in service",
  );
  const band = page.getByTestId("asset-risk-band");
  await expect(band).toHaveText("~10% per Turn");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await reliability.selectOption("redundant");
  await expect(band).toHaveText("~2% per Turn");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.15B");
  await reliability.selectOption("none");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  // At the 10x carried over, the whole of this Turn takes about a second.
  await holdTurnWhenShown(page, "Pathfinder Orbiter failed");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();

  const failed = eventEntries(page).first();
  await expect(failed.getByRole("heading")).toHaveText(
    "Pathfinder Orbiter failed",
  );
  await expect(failed).toHaveClass(/failed/);
  await expect(failed).toContainText("costs no Public Support");
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("summary-assets-failed")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("reports a failed landing as a crash at the Landing Site", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the landing so the pause lands in time, then plays out the Turn.
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
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
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
