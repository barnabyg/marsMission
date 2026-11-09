import { expect, test, type Locator } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  launchHeld,
  operatingRow,
  overrideProgramData,
  pauseAtEvent,
  pauseAtEventAfter,
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
  // Over 5 s: plays to the landing, then on to the next Turn.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${roverSeed}`);
  await chooseAssets(page, ["Trailblazer Rover"]);

  const row = page
    .getByTestId("chosen-asset")
    .filter({ hasText: "Trailblazer Rover" });
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "first landing here earns 120 Science",
  );
  await expect(
    row.getByLabel("Service Life for Trailblazer Rover"),
  ).toBeVisible();
  const inService = page
    .getByTestId("asset-in-service")
    .filter({ hasText: "Trailblazer Rover" });
  await expect(
    inService.getByLabel("Reliability for Trailblazer Rover in service"),
  ).toBeVisible();
  await expect(inService.getByTestId("asset-risk-band")).toBeVisible();
  const activity = page.getByLabel("Activity for Trailblazer Rover");
  await expect(activity).toHaveValue("soil-analysis");
  // Each other Activity says what it earns a Turn, in each of Science, Public Support and Research Grant that it earns
  // any of, while the chosen one, closed, shows its name in full.
  await expect(activity.getByRole("option")).toHaveText([
    "Soil analysis",
    "Long traverse: earns 160 Science and 14 Public Support a Turn",
    "Sample caching: collects 10 samples a Turn",
    "Nothing: stays in place and does no work this Turn",
  ]);
  // The chosen Activity's earnings are written out under its choice, which is too narrow to show them once closed.
  await expect(row.getByTestId("activity-earnings")).toHaveText(
    "Soil analysis earns 80 Science, 9 Public Support and $800M Research Grant a Turn.",
  );
  // The longer Service Life says the Research Grants its days would earn with the Activity chosen, against its cost
  // and Upkeep.
  const life = row.getByLabel("Service Life for Trailblazer Rover");
  await expect(life.getByRole("option")).toHaveText([
    "1,300 days ($0M)",
    "2,800 days: +1,500 days (about 1.9 Turns) earn $1.54B in Research Grants against $300M and $30M Upkeep",
  ]);
  // The Service Life label's tooltip says how to read them, after what a Service Life is.
  await row.locator("[data-term='Service Life']").hover();
  await expect(page.getByTestId("tooltip-detail")).toContainText(
    "Only Research Grants pay towards a longer Service Life and its Upkeep, as Science and Public Support aren't money.",
  );
  await page.mouse.move(0, 0);
  await activity.selectOption("long-traverse");
  await expect(row.getByTestId("activity-earnings")).toHaveText(
    "Long traverse earns 160 Science and 14 Public Support a Turn.",
  );
  await expect(life.getByRole("option").last()).toHaveText(
    "2,800 days: +1,500 days (about 1.9 Turns) earn $0M in Research Grants against $300M and $30M Upkeep",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "First landing at Jezero Crater",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "5x",
  );
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
  await expect(summary.getByTestId("summary-milestone")).toHaveCount(2);
  await expect(page.getByTestId("summary-first-landing")).toContainText(
    "120 Science",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // 120 for the site, 150 and 60 for the Milestones, and the 116.
  await expect(page.getByTestId("science")).toHaveText("446");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Jezero Crater",
  );
  await expect(operatingRow(page, "Trailblazer Rover")).toContainText(
    "735 days",
  );
  await expect(
    page
      .getByTestId("operating-assets")
      .getByLabel("Activity for Trailblazer Rover"),
  ).toHaveValue("long-traverse");
  // Operating at Mars, too, each Activity says what it earns a Turn, and the chosen one's earnings are written out.
  await expect(
    page.getByTestId("operating-assets").getByTestId("activity-earnings"),
  ).toHaveText("Long traverse earns 160 Science and 14 Public Support a Turn.");
  await expect(
    page
      .getByTestId("operating-assets")
      .getByLabel("Activity for Trailblazer Rover")
      .getByRole("option")
      .first(),
  ).toHaveText(
    "Soil analysis: earns 80 Science, 9 Public Support and $800M Research Grant a Turn",
  );
  await expect(page.getByTestId("milestones")).toContainText(
    "First rover on Mars",
  );
  expect(problems).toEqual([]);
});

test("lands a rover and a lander at one site, each with its own Activity", async ({
  page,
}) => {
  // Over 5 s: plays to the landing, the last months of the way at 1x.
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
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

  // Held close to the day of the landing, on 4 July 2029, when Mars turns its Landing Site to the camera.
  await launchHeld(page);
  await pauseAtEventAfter(
    page,
    "First landing at Jezero Crater",
    "25 March 2029",
  );
  await expect(
    eventEntries(page).filter({ hasText: "Entry/descent/landing" }),
  ).toContainText(
    "The lander and the rover came through the atmosphere and touched down at Jezero Crater.",
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Mars orbit" })
    .click();
  // Plays at 1x and pauses from inside the page as soon as both labels show, because a click from out here can come
  // after the Turn ends. If the Turn ends first, the check after this fails at once.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const button = (name: string) =>
          [...document.querySelectorAll("button")].find(
            (button) => button.textContent === name,
          );
        button("1x")?.click();
        requestAnimationFrame(function check() {
          const shown = document.querySelectorAll(
            "[data-testid=mars-surface-asset]",
          ).length;
          if (shown < 2 && button("Pause")) {
            requestAnimationFrame(check);
            return;
          }
          button("Pause")?.click();
          resolve();
        });
      }),
  );
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  const landed = page.getByTestId("mars-surface-asset");
  await expect(landed).toHaveText([
    "Prospector Lander at Jezero Crater",
    "Trailblazer Rover at Jezero Crater",
  ]);
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
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverCrashSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await chooseAssets(page, ["Prospector Lander", "Trailblazer Rover"]);

  // Held close to the day of the crash, on 4 July 2029, when Mars turns its Landing Site to the camera.
  await launchHeld(page);
  await pauseAtEventAfter(
    page,
    "Entry/descent/landing failed",
    "25 March 2029",
  );
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
