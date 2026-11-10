import { expect, test, type Page } from "@playwright/test";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import {
  eventEntries,
  expectSurfaceUnavailable,
  holdSequence,
  holdTurnWhenShown,
  launchHeld,
  pauseAtEvent,
  pauseAtEventAfter,
  playFastUntilSequence,
  surfaceAssets,
  switchViewWhilePlaying,
  viewButton,
} from "./playbackHelpers";
import { overrideProgramData } from "./saveHelpers";
import {
  crashSeed,
  landerAndRoverMoney,
  landerAndRoverSeed,
  landerLostAtLaunchSeed,
  landerLostOnTheWaySeed,
  successSeed,
} from "./seeds";

test.use({ viewport: missionViewport });

/** Launches a lander and a rover to Jezero Crater, holding the Turn as Mission Mode opens. */
async function launchLanderAndRover(page: Page): Promise<void> {
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${landerAndRoverSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await chooseAssets(page, ["Prospector Lander", "Trailblazer Rover"]);
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
}

test("switches to the surface view and back during a Turn, at any speed and while paused", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchLanderAndRover(page);
  const current = page.getByTestId("current-view");
  const speed = page.getByTestId("current-speed");
  await expect(speed).toHaveText("Paused");

  // Switching while playing leaves the speed alone.
  expect(await switchViewWhilePlaying(page, "5x", "Surface")).toEqual({
    view: "Surface",
    speed: "5x",
  });

  // On the way, the destination with nothing there yet.
  await expect(current).toHaveText("Surface");
  await expect(viewButton(page, "Surface")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Nothing here yet",
  );
  await expect(page.getByTestId("surface-status")).toContainText(
    "On its way: Prospector Lander, Trailblazer Rover",
  );
  // The site's list names them, so the journey's line doesn't as well.
  await expect(page.getByTestId("journey-progress")).toHaveCount(0);
  await expect(surfaceAssets(page)).toHaveCount(0);
  await expect(page.getByLabel("Landing Site to show")).toHaveCount(0);
  await expect(viewButton(page, "Surface")).not.toHaveAccessibleDescription(
    /./,
  );

  // Paused, which holds the date and the events column.
  await expect(speed).toHaveText("Paused");
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
  expect(problems).toEqual([]);
});

test("plays the landing in the surface view, then shows the Assets there and only there, to the Turn's end", async ({
  page,
}) => {
  // Over 5 s: a landing takes the same real time at any speed.
  const problems = watchForProblems(page);
  await launchLanderAndRover(page);
  const current = page.getByTestId("current-view");
  await viewButton(page, "Surface").click();
  await expect(current).toHaveText("Surface");

  // The landing plays here, and the Assets are at the site afterwards. It's on 4 July 2029, and the Turn is slowed to
  // 1x as it begins, which leaves well over a year of the Turn for the whole landing.
  const landed = holdSequence(page);
  await playFastUntilSequence(page);
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

  // At top speed, and the Turn still runs to its end. Switched from inside the page, as at 10x the Turn can end before
  // a click from out here lands.
  expect(await switchViewWhilePlaying(page, "10x", "Surface")).toEqual({
    view: "Surface",
    speed: "10x",
  });
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("disables the surface view and says why when nothing has landed and no landing is on its way", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
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

test("moves from the surface to the spacecraft on the day the only landing on its way is lost", async ({
  page,
}) => {
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

  await pauseAtEvent(page, "Mars transfer burn failed", () =>
    page.getByRole("button", { name: "1x" }).click(),
  );
  // The loss on the way is shown close up, and there's no Landing Site left to go back to.
  await expect(page.getByTestId("current-view")).toHaveText("Spacecraft");
  await expectSurfaceUnavailable(page);
  expect(problems).toEqual([]);
});

test("plays a crash on the surface without showing it as operating, then moves to Mars orbit and says why", async ({
  page,
}) => {
  // Over 5 s: waits for the crash to play out, which takes the same real time at any speed.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${crashSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await launchHeld(page);
  await viewButton(page, "Surface").click();
  await expect(page.getByTestId("surface-status")).toContainText(
    "On its way: Prospector Lander",
  );
  // Slowed to 1x well before the crash on 4 July 2029, so there's time left in the Turn for it to play out.
  await pauseAtEventAfter(
    page,
    "Entry/descent/landing failed",
    "25 March 2029",
  );
  const current = page.getByTestId("current-view");
  await expect(current).toHaveText("Surface");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("mission-scene")).toHaveAttribute(
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
  await expect(page.getByTestId("operating-at-mars")).toHaveCount(0);
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
  await expect(page.getByTestId("operating-at-mars")).toHaveCount(0);
  expect(problems).toEqual([]);
});
