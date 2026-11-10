import { expect, test, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import {
  expectSurfaceUnavailable,
  holdSequence,
  holdTurnWhenShown,
  launchHeld,
  pauseAtEvent,
  surfaceAssets,
  viewButton,
} from "./playbackHelpers";
import { successSeed } from "./seeds";

// The surface view with Assets at more than one Landing Site.

test.use({ viewport: missionViewport });

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
  // Over 5 s: plays to the two days the Assets stop, which is what the test is about.
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
  await pauseAtEvent(page, "Trailblazer Rover: Service Life ended", () =>
    page.getByRole("button", { name: "5x" }).click(),
  );
  await expect(site).toHaveText("Jezero Crater");
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  // With no site left, the view moves to Mars orbit and says why it can't go back.
  await pauseAtEvent(page, "Prospector Lander: Service Life ended", () =>
    page.getByRole("button", { name: "5x" }).click(),
  );
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await expectSurfaceUnavailable(page);
  await expect(surfaceAssets(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("shows a crash at its own site where other sites have Assets, and then goes back to them", async ({
  page,
}) => {
  // Over 5 s: waits for the crash to play out, which takes the same real time at any speed.
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
  await page
    .getByRole("combobox", { name: "Landing Site" })
    .selectOption("meridiani-planum");
  const site = page.getByTestId("surface-site");

  // The player is looking at another site, which gives way when the crash happens.
  await launchHeld(page);
  await viewButton(page, "Surface").click();
  await page.getByLabel("Landing Site to show").selectOption("Jezero Crater");
  await expect(site).toHaveText("Jezero Crater");
  // Held a frame or two after the crash begins. At 10x that can be weeks of the Turn, but the crash plays in real time.
  await pauseAtEvent(page, "Entry/descent/landing failed", () =>
    page.getByRole("button", { name: "10x" }).click(),
  );
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
