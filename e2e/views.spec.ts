import { expect, test, type Locator } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  fourKViewport,
  holdTurnWhenShown,
  launchFirstMission,
  launchHeld,
  missionViewport,
  orbiterLabels,
  pauseAtEvent,
  pauseAtEventAfter,
  switchViewWhilePlaying,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import { crashSeed, landingSeed, seedFailingAt, successSeed } from "./seeds";
import { confirmEndWithoutLaunching } from "./turnHelpers";

test.use({ viewport: missionViewport });

test("switches to the Mars orbit view and back during a Turn, at any speed and while paused", async ({
  page,
}) => {
  // Over 5 s: switches view at 5x, while paused and at 10x, then plays through to the end of the Turn.
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  const current = page.getByTestId("current-view");
  const speed = page.getByTestId("current-speed");
  await expect(current).toHaveText("Solar system");
  await expect(viewButton(page, "Solar system")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".view-label", { hasText: "Earth" })).toBeVisible();

  // While playing, which leaves the speed alone.
  expect(await switchViewWhilePlaying(page, "5x", "Mars orbit")).toEqual({
    view: "Mars orbit",
    speed: "5x",
  });
  await expect(current).toHaveText("Mars orbit");
  await expect(viewButton(page, "Mars orbit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(viewButton(page, "Solar system")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator(".view-label", { hasText: "Earth" })).toHaveCount(
    0,
  );

  // While paused, which holds the date and the events column.
  await expect(speed).toHaveText("Paused");
  const date = await page.getByTestId("mission-date").textContent();
  const happened = await eventEntries(page).count();
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await viewButton(page, "Mars orbit").click();
  await expect(current).toHaveText("Mars orbit");
  await expect(speed).toHaveText("Paused");
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");
  expect(await eventEntries(page).count()).toBe(happened);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // At top speed, after the arrival, and the Turn still runs to its end.
  await pauseAtEvent(page, "Mars orbit insertion", () =>
    page.getByRole("button", { name: "10x" }).click(),
  );
  expect(await switchViewWhilePlaying(page, "10x", "Solar system")).toEqual({
    view: "Solar system",
    speed: "10x",
  });
  await expect(current).toHaveText("Solar system");
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("shows an orbiter going round Mars from the day it arrives, only in the Mars orbit view", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(0);

  await pauseAtEvent(page, "Mars orbit insertion", () =>
    page.getByRole("button", { name: "5x" }).click(),
  );
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  await expect(orbiterLabels(page)).toBeVisible();

  await viewButton(page, "Solar system").click();
  await expect(orbiterLabels(page)).toHaveCount(0);
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(1);

  // It's still there next Turn, from the first day. Ending this Turn keeps the next one at 1x, as
  // a Turn at 10x can be over in the browser tests before the label has been checked.
  await page.getByRole("button", { name: /^Skip to / }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  const endTurn = page.getByRole("button", {
    name: "End Turn without launching",
  });
  await expect(endTurn).toBeVisible();
  await holdTurnWhenShown(page);
  await endTurn.click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  expect(problems).toEqual([]);
});

test("never shows an orbiter whose Mission failed", async ({ page }) => {
  // Over 5 s: checks the view for the rest of the Turn.
  const problems = watchForProblems(page);
  await launchFirstMission(
    page,
    seedFailingAt("Mars orbit insertion"),
    "Mars orbit insertion failed",
    "5x",
  );
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(0);
  await expect(page.getByTestId("operating-at-mars")).toHaveCount(0);

  await page.getByRole("button", { name: "5x" }).click();
  await expect
    .poll(async () => {
      const summary = await page.getByTestId("turn-summary").count();
      const orbiters = await orbiterLabels(page).count();
      expect(orbiters).toBe(0);
      return summary;
    })
    .toBe(1);
  expect(problems).toEqual([]);
});

test("shows a lander coming down and then on the surface", async ({ page }) => {
  const problems = watchForProblems(page);
  // A small window, so that frames are quick enough not to skip past the landing at this test speed.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  // The landing takes the view to the surface. The marker stays for some days after it, so the player can go back to look.
  // Holding from inside the page is what stops the Turn in that time, as the marker before the landing is too brief to catch.
  await holdTurnWhenShown(page, "Entry/descent/landing");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await viewButton(page, "Mars orbit").click();
  const landing = page.getByTestId("mars-landing");
  await expect(landing).toHaveText(
    "Prospector Lander: landing at Jezero Crater",
  );
  await expect(page.getByTestId("mars-surface-asset")).toHaveCount(0);

  await page.getByRole("button", { name: "1x" }).click();
  await expect(page.getByTestId("mars-surface-asset")).toHaveText(
    "Prospector Lander at Jezero Crater",
  );
  await expect(landing).toHaveCount(0);
  await expect(orbiterLabels(page)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("shows a crash in red in the Mars orbit view, when the player goes there from the surface", async ({
  page,
}) => {
  // Over 5 s: plays to the crash, the last months of the way at 1x.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${crashSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  // Held close to the day of the crash, on 4 July 2029, when Mars turns its Landing Site to the camera.
  await launchHeld(page);
  await pauseAtEventAfter(
    page,
    "Entry/descent/landing failed",
    "25 March 2029",
  );
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await viewButton(page, "Mars orbit").click();
  const crash = page.getByTestId("mars-landing");
  await expect(crash).toHaveText("Prospector Lander: crashed at Jezero Crater");
  await expect(crash).toHaveClass(/crashed-label/);
  await expect(crash).toBeVisible();
  await expect(page.getByTestId("mars-surface-asset")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("keeps the controls still as the date changes, even in a window too small for them all", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await confirmEndWithoutLaunching(page);
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  const places = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const seen = new Set<number>();
        requestAnimationFrame(function sample() {
          const buttons = [...document.querySelectorAll("button")];
          const fastest = buttons.find(
            ({ textContent }) => textContent === "10x",
          );
          if (!fastest) {
            resolve([...seen]);
            return;
          }
          seen.add(fastest.getBoundingClientRect().x);
          requestAnimationFrame(sample);
        });
        // Every month of the Turn goes past, up to its summary, where the buttons have gone.
        [...document.querySelectorAll("button")]
          .find(({ textContent }) => textContent === "5x")
          ?.click();
      }),
  );
  expect(places).toHaveLength(1);
});

test("groups the toolbar: views on the left, playback with icons in the centre and the skip button on the right", async ({
  page,
}) => {
  // Checks where things sit on screen, at the size this was laid out for.
  await page.setViewportSize(fourKViewport);
  await launchFirstMission(page, successSeed);
  const box = async (locator: Locator) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("Not on screen");
    return found;
  };
  const playbackGroup = page.getByTestId("mission-playback");
  const endTurn = page.getByRole("button", { name: /^Skip to / });
  const views = await box(page.getByRole("group", { name: "View" }));
  const playback = await box(playbackGroup);
  const end = await box(endTurn);
  const width = page.viewportSize()?.width ?? 0;

  expect(views.x + views.width).toBeLessThan(playback.x);
  expect(playback.x + playback.width).toBeLessThan(end.x);
  expect(Math.abs(playback.x + playback.width / 2 - width / 2)).toBeLessThan(
    width * 0.05,
  );
  expect(width - (end.x + end.width)).toBeLessThan(width * 0.05);
  // A secondary button, as the accent is kept for the pressed speed and the current view.
  await expect(endTurn).toHaveCSS(
    "background-color",
    await page
      .getByRole("button", { name: "Mute sound" })
      .evaluate((mute) => getComputedStyle(mute).backgroundColor),
  );

  // Each playback control shows an icon and keeps the name it had.
  for (const name of ["Pause", "1x", "5x", "10x", "Mute sound"]) {
    await expect(
      playbackGroup
        .getByRole("button", { name, exact: true })
        .locator("svg.icon"),
    ).toBeVisible();
  }
});

test("greys out a view with nothing to show, saying why on hover", async ({
  page,
}) => {
  // An orbiter alone: nothing lands, so the Surface view has nothing to show.
  await launchFirstMission(page, successSeed);
  const surface = viewButton(page, "Surface");
  await expect(surface).toBeDisabled();
  await expect(surface).toHaveAttribute(
    "title",
    "Surface view: nothing is on the surface and no landing is on its way.",
  );
  await expect(surface).toHaveCSS("background-color", "rgb(43, 47, 58)");
  await expect(viewButton(page, "Mars orbit")).not.toHaveCSS(
    "background-color",
    "rgb(43, 47, 58)",
  );
});
