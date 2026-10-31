import { expect, test, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import {
  chooseAssets,
  eventEntries,
  holdSequence,
  holdTurnWhenShown,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  crashSeed,
  landerAndRoverMoney,
  landerAndRoverSeed,
  landerLostAtLaunchSeed,
  landerLostOnTheWaySeed,
  landingSeed,
  roverSeed,
  successSeed,
} from "./seeds";

function viewButton(
  page: Page,
  name: "Solar system" | "Mars orbit" | "Surface",
) {
  return page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });
}

function surfaceAssets(page: Page) {
  return page.getByTestId("surface-asset");
}

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

/** Where the camera is at the surface view's usual shot, as the scene reports it. */
const surfaceCamera = "0.000 2.200 12.500";

function sceneView(page: Page) {
  return page.getByTestId("solar-system-view");
}

async function launchLanding(page: Page): Promise<void> {
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
}

function playedMs(page: Page) {
  return sceneView(page)
    .getAttribute("data-sequence-ms")
    .then((value) => Number(value));
}

test("moves the view to the surface for a landing at 3840×2160, with a smooth camera move and the landing playing", async ({
  page,
}) => {
  // Over 5 s: a landing takes the same real time as it would in play.
  const problems = watchForProblems(page);
  await launchLanding(page);
  const canvas = sceneView(page).locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("current-view")).toHaveText("Solar system");
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const seen: number[][] = [];
    Object.assign(window, { cameraPath: seen });
    new MutationObserver(() => {
      seen.push((element.dataset.cameraPosition ?? "").split(" ").map(Number));
    }).observe(element, {
      attributes: true,
      attributeFilter: ["data-camera-position"],
    });
  });

  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(sceneView(page)).toHaveAttribute("data-sequence", "landing");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Landing: Prospector Lander",
  );
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await holdSequence(page);
  await expect(canvas).toHaveAttribute("data-camera-position", surfaceCamera);
  await expect(sceneView(page)).not.toHaveAttribute("data-sequence");
  await expect(page.getByTestId("surface-status")).not.toContainText(
    "Landing:",
  );
  await expect(surfaceAssets(page)).toBeInViewport();

  const path = await page.evaluate(
    () => (window as unknown as { cameraPath: number[][] }).cameraPath,
  );
  const steps = path
    .slice(1)
    .map((point, index) =>
      Math.hypot(
        ...point.map((value, axis) => value - (path[index]?.[axis] ?? 0)),
      ),
    );
  expect(path.length).toBeGreaterThan(4);
  // The moves are each under 10 units, so this is under a quarter of one.
  expect(Math.max(...steps)).toBeLessThan(2.5);
  expect(problems).toEqual([]);
});

test("holds a landing when paused, carries on without a jump at a new speed, and leaves it behind on End Turn", async ({
  page,
}) => {
  // Over 5 s: waits for the landing, and checks it stands still for a while.
  const problems = watchForProblems(page);
  await launchLanding(page);
  await holdSequence(page, 1000);

  // Paused, it stands still in real time.
  const held = await playedMs(page);
  const date = await page.getByTestId("mission-date").textContent();
  await page.waitForTimeout(800);
  expect(await playedMs(page)).toBe(held);
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");

  // At a new speed, it goes on from where it was.
  await page.getByRole("button", { name: "5x" }).click();
  await expect.poll(() => playedMs(page)).toBeGreaterThan(held);
  expect(await playedMs(page)).toBeLessThan(held + 3000);
  await page.getByRole("button", { name: "Pause" }).click();

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  await expect(sceneView(page)).toHaveCount(0);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  // Next Turn has no landing, whatever the last one was doing, and the lander is simply there.
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("current-view")).toHaveText("Solar system");
  await expect(sceneView(page)).not.toHaveAttribute("data-sequence");
  await viewButton(page, "Surface").click();
  await expect(surfaceAssets(page)).toBeInViewport();
  expect(problems).toEqual([]);
});

test("lets the player switch away during a landing without pulling them back, and finds it still going on return", async ({
  page,
}) => {
  // Over 5 s: waits for the landing, then plays through it with the view elsewhere.
  const problems = watchForProblems(page);
  await launchLanding(page);
  await holdSequence(page, 500);
  const current = page.getByTestId("current-view");
  await expect(current).toHaveText("Surface");

  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await expect(page.getByTestId("surface-status")).toHaveCount(0);
  const before = await playedMs(page);

  await page.getByRole("button", { name: "1x" }).click();
  await expect.poll(() => playedMs(page)).toBeGreaterThan(before + 1000);
  await expect(current).toHaveText("Solar system");

  await viewButton(page, "Surface").click();
  await expect(current).toHaveText("Surface");
  await expect(page.getByTestId("surface-status")).toContainText("Landing:");
  await viewButton(page, "Mars orbit").click();
  await expect(current).toHaveText("Mars orbit");

  // Still there after the landing has finished, with nothing else to move it.
  await expect(sceneView(page)).not.toHaveAttribute("data-sequence");
  await expect(current).toHaveText("Mars orbit");
  expect(problems).toEqual([]);
});

test("moves a rover's label across the surface on a Long traverse", async ({
  page,
}) => {
  // Over 5 s: waits for the landing to finish, and for the rover to drive off.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${roverSeed}`);
  await chooseAssets(page, ["Trailblazer Rover"]);
  await page
    .getByLabel("Activity for Trailblazer Rover")
    .selectOption("long-traverse");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await holdSequence(page);
  // Only once the camera has stopped can a moving label be down to the rover.
  await expect(sceneView(page).locator("canvas")).toHaveAttribute(
    "data-camera-position",
    surfaceCamera,
  );
  const label = surfaceAssets(page);
  await expect(label).toHaveClass(/rover-label/);
  const place = () => label.evaluate((element) => element.style.transform);

  const before = await place();
  await page.getByRole("button", { name: "1x" }).click();
  await expect.poll(place).not.toBe(before);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await page.waitForTimeout(300);
  const moved = await place();
  await page.waitForTimeout(300);
  await expect(label).toBeInViewport();
  expect(await place()).toBe(moved);
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

/** Records from page load every sound as it starts, and what the events column last held. */
async function listenToTheTurn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sounds: string[] = [];
    let events: string[] = [];
    Object.assign(window, {
      turnRecord: () => ({ sounds, events }),
    });
    const play: () => Promise<void> = Reflect.get(
      HTMLMediaElement.prototype,
      "play",
    );
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      sounds.push(this.src.split("/").at(-1) ?? "");
      return play.call(this);
    };
    addEventListener("DOMContentLoaded", () => {
      new MutationObserver(() => {
        const entries = [
          ...document.querySelectorAll("[data-testid=event-entry]"),
        ].map((entry) => entry.textContent);
        if (entries.length > 0) events = entries;
      }).observe(document.body, { childList: true, subtree: true });
    });
  });
}

/** Plays a Mission to its Turn summary, leaving the view alone unless told to keep switching. */
async function playLanding(page: Page, keepSwitching: boolean) {
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  const views = ["Surface", "Mars orbit", "Solar system"] as const;
  let next = 0;
  while (keepSwitching && (await summary.count()) === 0) {
    // The Turn may end before the click lands, which is fine.
    await viewButton(page, views[next % views.length] ?? "Surface")
      .click({ timeout: 500 })
      .catch(() => undefined);
    next += 1;
  }
  await expect(summary).toBeVisible();
  const record = await page.evaluate(() =>
    (
      window as unknown as {
        turnRecord: () => { sounds: string[]; events: string[] };
      }
    ).turnRecord(),
  );
  return { summary: await summary.textContent(), ...record };
}

test("gives the same results, events and sounds with or without switching views", async ({
  page,
}) => {
  // Over 5 s: plays the same Turn twice to compare them.
  const problems = watchForProblems(page);
  await listenToTheTurn(page);
  const untouched = await playLanding(page, false);
  await page.evaluate(() => {
    localStorage.clear();
  });
  const switched = await playLanding(page, true);
  expect(untouched.summary).toContain("First landing on Mars");
  expect(untouched.sounds.length).toBeGreaterThan(0);
  expect(switched).toEqual(untouched);
  expect(problems).toEqual([]);
});
