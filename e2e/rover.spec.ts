import { expect, test, type Locator } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  landerAndRoverCrashSeed,
  landerAndRoverMoney,
  landerAndRoverSeed,
  roverSeed,
} from "./seeds";

/** Waits for two labels to be on screen and clear of each other, which takes until the camera has arrived. */
async function expectApart(labels: Locator): Promise<void> {
  const [first, second] = [labels.first(), labels.last()];
  await expect(first).toBeInViewport();
  await expect(second).toBeInViewport();
  await expect
    .poll(async () => {
      const [one, two] = await Promise.all([
        first.boundingBox(),
        second.boundingBox(),
      ]);
      return (
        one &&
        two &&
        (one.y + one.height <= two.y || two.y + two.height <= one.y)
      );
    })
    .toBe(true);
}

test("lands a rover, gives it an Activity and sees its Science in the Turn summary", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the landing so the pause lands in time, then plays on to the next Turn.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${roverSeed}`);
  await chooseAssets(page, ["Trailblazer Rover"]);

  const row = page.locator(".asset-choice", { hasText: "Trailblazer Rover" });
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "first landing here earns 120 Science",
  );
  await expect(
    row.getByLabel("Service Life for Trailblazer Rover"),
  ).toBeVisible();
  await expect(
    row.getByLabel("Reliability for Trailblazer Rover in service"),
  ).toBeVisible();
  await expect(row.getByTestId("asset-risk-band")).toBeVisible();
  const activity = page.getByLabel("Activity for Trailblazer Rover");
  await expect(activity).toHaveValue("soil-analysis");
  await expect(page.getByTestId("research-earnings")).toHaveText(
    "Ongoing Research for a whole Turn: Soil analysis earns 80 Science and 9 Public Support, and pays a $800M Research Grant. Long traverse earns 160 Science and 14 Public Support.",
  );
  await activity.selectOption("long-traverse");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await pauseAtEvent(page, "First landing at Jezero Crater");
  await expect(
    eventEntries(page).filter({ hasText: "Entry/descent/landing" }),
  ).toContainText(
    "The rover came through the atmosphere and touched down at Jezero Crater.",
  );
  for (const name of ["First landing on Mars", "First rover on Mars"]) {
    await expect(
      eventEntries(page).getByRole("heading", { name }),
    ).toBeVisible();
  }
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Trailblazer Rover: landed at Jezero Crater",
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Trailblazer Rover at Jezero Crater: Long traverse",
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Mars orbit" })
    .click();
  await page.getByRole("button", { name: "1x" }).click();
  await expect(page.getByTestId("mars-surface-asset")).toHaveText(
    "Trailblazer Rover at Jezero Crater",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  // It lands on day 215, so 565 of the Turn's 780 days earn their share, rounded up.
  await expect(page.getByTestId("summary-ongoing-research")).toContainText(
    "Trailblazer Rover, Long traverse: 116 Science and 11 Public Support over 565 days",
  );
  await expect(page.getByTestId("summary-research-grants")).toHaveCount(0);
  const summary = page.getByTestId("turn-summary");
  await expect(summary).toContainText("First landing on Mars: 150 Science");
  await expect(summary).toContainText("First rover on Mars: 60 Science");
  await expect(page.getByTestId("summary-first-landing")).toContainText(
    "120 Science",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // 120 for the site, 150 and 60 for the Milestones, and the 116.
  await expect(page.getByTestId("science")).toHaveText("446");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Trailblazer Rover at Jezero Crater: 735 days of Service Life left",
  );
  await expect(
    page
      .getByTestId("operating-assets")
      .getByLabel("Activity for Trailblazer Rover"),
  ).toHaveValue("long-traverse");
  await expect(page.getByTestId("milestones")).toContainText(
    "First rover on Mars",
  );
  expect(problems).toEqual([]);
});

test("lands a rover and a lander at one site, each with its own Activity", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the landing so the pause lands in time.
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverSeed}`);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await chooseAssets(page, ["Prospector Lander", "Trailblazer Rover"]);
  await page
    .getByLabel("Activity for Trailblazer Rover")
    .selectOption("long-traverse");
  // One landing, however many land.
  await expect(
    page
      .getByTestId("mission-event")
      .filter({ hasText: "Entry/descent/landing" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await pauseAtEvent(page, "First landing at Jezero Crater");
  await expect(
    eventEntries(page).filter({ hasText: "Entry/descent/landing" }),
  ).toContainText(
    "The lander and the rover came through the atmosphere and touched down at Jezero Crater.",
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Mars orbit" })
    .click();
  await page.getByRole("button", { name: "1x" }).click();
  const landed = page.getByTestId("mars-surface-asset");
  await expect(landed).toHaveCount(2);
  await expect(landed).toHaveText([
    "Prospector Lander at Jezero Crater",
    "Trailblazer Rover at Jezero Crater",
  ]);
  await page.getByRole("button", { name: "Pause" }).click();
  await expectApart(landed);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const earned = page.getByTestId("summary-ongoing-research");
  await expect(earned).toContainText("Prospector Lander, Surface research");
  await expect(earned).toContainText("Trailblazer Rover, Long traverse");
  await expect(page.getByTestId("summary-research-grants")).toContainText(
    "Prospector Lander",
  );
  await expect(page.getByTestId("summary-research-grants")).not.toContainText(
    "Trailblazer Rover",
  );
  expect(problems).toEqual([]);
});

test("loses a rover and a lander together in one crash", async ({ page }) => {
  // Over 5 s: waits at 1x for the landing so the pause lands in time.
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverCrashSeed}`);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await chooseAssets(page, ["Prospector Lander", "Trailblazer Rover"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await pauseAtEvent(page, "Entry/descent/landing failed");
  const failed = eventEntries(page).first();
  await expect(failed).toContainText(
    "The lander and the rover hit the ground too fast and crashed at Jezero Crater.",
  );
  await expect(failed).toContainText(
    "Lost with the Mission: Prospector Lander, Trailblazer Rover.",
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Mars orbit" })
    .click();
  const crashes = page.getByTestId("mars-landing");
  await expect(crashes).toHaveText([
    "Prospector Lander: crashed at Jezero Crater",
    "Trailblazer Rover: crashed at Jezero Crater",
  ]);
  await expectApart(crashes);
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "Prospector Lander: crashed at Jezero Crater. Trailblazer Rover: crashed at Jezero Crater",
  );
  expect(problems).toEqual([]);
});
