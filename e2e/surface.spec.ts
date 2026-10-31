import { expect, test, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import {
  chooseAssets,
  eventEntries,
  holdSequence,
  holdTurnWhenShown,
  overrideProgramData,
  pauseAtEvent,
  surfaceAssets,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import {
  crashSeed,
  landerAndRoverMoney,
  landerAndRoverSeed,
  landerLostAtLaunchSeed,
  landerLostOnTheWaySeed,
  successSeed,
} from "./seeds";

/** Waits for the unavailable surface button, with the reason on screen beside the views. */
async function expectSurfaceUnavailable(page: Page): Promise<void> {
  await expect(viewButton(page, "Surface")).toBeDisabled();
  await expect(page.getByTestId("surface-unavailable")).toBeVisible();
  await expect(page.getByTestId("surface-unavailable")).toHaveText(
    "Surface view: nothing is on the surface and no landing is on its way.",
  );
  await expect(viewButton(page, "Surface")).toHaveAccessibleDescription(
    "Surface view: nothing is on the surface and no landing is on its way.",
  );
}

async function launchLanderAndRover(page: Page): Promise<void> {
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverSeed}`);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await chooseAssets(page, ["Prospector Lander", "Trailblazer Rover"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
}

test("switches to the surface view and back during a Turn, at any speed and while paused", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the landing, then plays the rest of the Turn at top speed.
  const problems = watchForProblems(page);
  await launchLanderAndRover(page);
  const current = page.getByTestId("current-view");
  const speed = page.getByTestId("current-speed");
  await page.getByRole("button", { name: "5x" }).click();

  // On the way, the destination with nothing there yet. Playing, which leaves the speed alone.
  await viewButton(page, "Surface").click();
  await expect(current).toHaveText("Surface");
  await expect(viewButton(page, "Surface")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(speed).toHaveText("5x");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Nothing here yet",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "On its way: Prospector Lander, Trailblazer Rover",
  );
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByLabel("Landing Site to show")).toHaveCount(0);
  await expect(page.getByTestId("surface-unavailable")).toHaveCount(0);

  // Paused, which holds the date and the events column.
  await page.getByRole("button", { name: "Pause" }).click();
  const date = await page.getByTestId("mission-date").textContent();
  const happened = await eventEntries(page).count();
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await expect(page.getByTestId("surface-site")).toHaveCount(0);
  await viewButton(page, "Surface").click();
  await expect(current).toHaveText("Surface");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(speed).toHaveText("Paused");
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");
  expect(await eventEntries(page).count()).toBe(happened);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // The landing plays here, and the Assets are at the site afterwards.
  const landed = holdSequence(page);
  await page.getByRole("button", { name: "1x" }).click();
  await landed;
  await expect(current).toHaveText("Surface");
  await expect(surfaceAssets(page)).toHaveText([
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  await expect(surfaceAssets(page).first()).toHaveClass(/lander-label/);
  await expect(surfaceAssets(page).last()).toHaveClass(/rover-label/);
  await expect(surfaceAssets(page).first()).toBeInViewport();
  await expect(surfaceAssets(page).last()).toBeInViewport();
  await expect(page.getByTestId("surface-status")).toContainText(
    "Prospector Lander (lander): Surface research",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "Trailblazer Rover (rover): Soil analysis",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Only in this view.
  await viewButton(page, "Mars orbit").click();
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByTestId("mars-surface-asset").first()).toBeAttached();

  // At top speed, and the Turn still runs to its end.
  await page.getByRole("button", { name: "10x" }).click();
  await viewButton(page, "Surface")
    .click({ timeout: 2000 })
    .catch(() => undefined);
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("disables the surface view and says why when nothing has landed and no landing is on its way", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expectSurfaceUnavailable(page);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(page.getByTestId("current-view")).toHaveText("Solar system");
  expect(problems).toEqual([]);
});

test("disables the surface view from the start when the lander is lost at launch", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${landerLostAtLaunchSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expectSurfaceUnavailable(page);
  expect(problems).toEqual([]);
});

test("moves from the surface to Mars orbit on the day the only landing on its way is lost", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the failure so the pause lands in time.
  const problems = watchForProblems(page);
  // Later, because in real data it's over before anything can be clicked at this test speed.
  await page.route("**/data/mission-events.json", async (route) => {
    const response = await route.fetch();
    const events = (await response.json()) as {
      id: string;
      timing: { days: number };
    }[];
    const burn = events.find(({ id }) => id === "mars-transfer-burn");
    if (burn) burn.timing.days = 100;
    await route.fulfill({ json: events });
  });
  await page.goto(`/?seed=${landerLostOnTheWaySeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await viewButton(page, "Surface").click();
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Mars transfer burn failed");
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await expectSurfaceUnavailable(page);
  expect(problems).toEqual([]);
});

test("plays a crash on the surface without showing it as operating, then moves to Mars orbit and says why", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the landing, then for the crash to play out, which takes real time.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${crashSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await viewButton(page, "Surface").click();
  await expect(page.getByTestId("surface-status")).toContainText(
    "On its way: Prospector Lander",
  );

  await pauseAtEvent(page, "Entry/descent/landing failed");
  const current = page.getByTestId("current-view");
  await expect(current).toHaveText("Surface");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("solar-system-view")).toHaveAttribute(
    "data-sequence",
    "crash",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "Crash: Prospector Lander",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "Nothing operating here",
  );
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByTestId("surface-crash")).toHaveText(
    "Prospector Lander: crashed",
  );
  await expect(viewButton(page, "Surface")).toBeEnabled();
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  const over = holdSequence(page);
  await page.getByRole("button", { name: "1x" }).click();
  await over;
  await expect(current).toHaveText("Mars orbit");
  await expectSurfaceUnavailable(page);
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByTestId("surface-crash")).toHaveCount(0);
  await expect(page.getByTestId("mars-landing")).toHaveText(
    "Prospector Lander: crashed at Jezero Crater",
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  expect(problems).toEqual([]);
});

/**
 * Opens Planning Mode with a lander and a later rover at two Landing Sites, which stop on known days
 * of the coming Turn, or a good while after it if they're to last.
 */
async function openTwoSites(page: Page, lasting = false): Promise<void> {
  const extraDays = lasting ? 5000 : 0;
  // Nothing fails in service, so that they stop on those days.
  await page.route("**/data/assets.json", async (route) => {
    const response = await route.fetch();
    const assets = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: assets.map((asset) => ({ ...asset, failureChancePerTurn: 0 })),
    });
  });
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify({
        formatVersion: 6,
        program: {
          seed: successSeed,
          turnNumber: 9,
          date: "2045-01-01",
          moneyMillions: 5000,
          publicSupport: 500,
          science: 800,
          milestoneIds: [],
          landedSiteIds: ["jezero-crater", "gale-crater"],
          knownLandingSiteIds: [
            "jezero-crater",
            "gale-crater",
            "meridiani-planum",
          ],
          surveyedLandingSiteIds: [],
          fundingThresholdsPaid: [],
          operatingAssets: [
            {
              assetId: "prospector-lander",
              name: "Prospector Lander",
              kind: "lander",
              landingSiteId: "jezero-crater",
              activityId: "surface-research",
              arrivedOn: "2035-01-01",
              // 400 days into the Turn.
              serviceLifeDays: 4053 + extraDays,
              reliabilityLevelId: "none",
            },
            {
              assetId: "trailblazer-rover",
              name: "Trailblazer Rover",
              kind: "rover",
              landingSiteId: "gale-crater",
              activityId: "soil-analysis",
              arrivedOn: "2040-01-01",
              // 200 days into the Turn.
              serviceLifeDays: 2027 + extraDays,
              reliabilityLevelId: "none",
            },
          ],
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("9");
}

test("picks between Landing Sites, and drops each from the day its Assets stop", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for two Assets to stop, which is what the test is about.
  const problems = watchForProblems(page);
  await openTwoSites(page);
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await viewButton(page, "Surface").click();
  const site = page.getByTestId("surface-site");
  const picker = page.getByLabel("Landing Site to show");

  // The latest landing to start with, and the player can pick the other.
  await expect(site).toHaveText("Gale Crater");
  await expect(surfaceAssets(page)).toHaveText(["Trailblazer Rover"]);
  await expect(surfaceAssets(page)).toHaveClass(/rover-label/);
  await expect(picker.getByRole("option")).toHaveText([
    "Gale Crater",
    "Jezero Crater",
  ]);
  await picker.selectOption("Jezero Crater");
  await expect(site).toHaveText("Jezero Crater");
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  await expect(surfaceAssets(page)).toHaveClass(/lander-label/);
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await picker.selectOption("Gale Crater");
  await expect(site).toHaveText("Gale Crater");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // The player's pick goes with its last Asset, and the view moves to the other site.
  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Trailblazer Rover: Service Life ended");
  await expect(site).toHaveText("Jezero Crater");
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  // With no site left, the view moves to Mars orbit and says why it can't go back.
  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Prospector Lander: Service Life ended");
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await expectSurfaceUnavailable(page);
  await expect(surfaceAssets(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("shows a crash at its own site where other sites have Assets, and then goes back to them", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the crash to play out, which takes real time.
  const problems = watchForProblems(page);
  await page.route("**/data/landing-sites.json", async (route) => {
    const response = await route.fetch();
    const sites = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: sites.map((site) => ({ ...site, landingRisk: 1 })),
    });
  });
  // Only the landing fails, whatever the rolls for the rest of the journey come to.
  await page.route("**/data/mission-events.json", async (route) => {
    const response = await route.fetch();
    const events = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: events.map((event) =>
        event.failureProbability === "landingSite"
          ? event
          : { ...event, failureProbability: 0 },
      ),
    });
  });
  await openTwoSites(page, true);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByLabel("Landing Site").selectOption("meridiani-planum");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const site = page.getByTestId("surface-site");

  // The player is looking at another site, which gives way when the crash happens.
  await viewButton(page, "Surface").click();
  await page.getByLabel("Landing Site to show").selectOption("Jezero Crater");
  await expect(site).toHaveText("Jezero Crater");
  await pauseAtEvent(page, "Entry/descent/landing failed");
  await expect(site).toHaveText("Meridiani Planum");
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByTestId("surface-crash")).toHaveText(
    "Prospector Lander: crashed",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "Crash: Prospector Lander",
  );

  // The player can look elsewhere during it, and it doesn't pull them back.
  const picker = page.getByLabel("Landing Site to show");
  await picker.selectOption("Jezero Crater");
  await expect(site).toHaveText("Jezero Crater");
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  await expect(page.getByTestId("surface-status")).not.toContainText("Crash:");
  await picker.selectOption("Meridiani Planum");

  const over = holdSequence(page);
  await page.getByRole("button", { name: "1x" }).click();
  await over;
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(site).toHaveText("Gale Crater");
  await expect(picker.getByRole("option")).toHaveText([
    "Gale Crater",
    "Jezero Crater",
  ]);
  await expect(surfaceAssets(page)).toHaveText(["Trailblazer Rover"]);
  await expect(page.getByTestId("operating-at-mars")).not.toContainText(
    "Meridiani",
  );
  expect(problems).toEqual([]);
});
