import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  crashSeed,
  landingSeed,
  orbiterSafeSeed,
  seedFailingAt,
  successSeed,
} from "./seeds";

function viewButton(page: Page, name: "Solar system" | "Mars orbit") {
  return page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });
}

function orbiterLabels(page: Page) {
  return page.getByTestId("mars-orbit-asset");
}

async function launchFirstMission(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
}

test("switches to the Mars orbit view and back during a Turn, at any speed and while paused", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "5x" }).click();
  await viewButton(page, "Mars orbit").click();
  await expect(current).toHaveText("Mars orbit");
  await expect(viewButton(page, "Mars orbit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(viewButton(page, "Solar system")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(speed).toHaveText("5x");
  await expect(page.locator(".view-label", { hasText: "Earth" })).toHaveCount(
    0,
  );

  // While paused, which holds the date and the events column.
  await page.getByRole("button", { name: "Pause" }).click();
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

  // At top speed, and the Turn still runs to its end.
  await page.getByRole("button", { name: "10x" }).click();
  await expect(
    eventEntries(page).getByRole("heading", { name: "Mars orbit insertion" }),
  ).toBeVisible();
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("shows an orbiter going round Mars from the day it arrives, only in the Mars orbit view", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  await pauseAtEvent(page, "Launch");
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(0);

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  await expect(orbiterLabels(page)).toBeVisible();

  await viewButton(page, "Solar system").click();
  await expect(orbiterLabels(page)).toHaveCount(0);
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveCount(1);

  // It's still there next Turn, from the first day. Ending this Turn keeps the next one at 1x, as
  // a Turn at 10x can be over in the browser tests before the label has been checked.
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "Pause" }).click();
  await viewButton(page, "Mars orbit").click();
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);
  expect(problems).toEqual([]);
});

test("never shows an orbiter whose Mission failed", async ({ page }) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, seedFailingAt("Mars orbit insertion"));
  await viewButton(page, "Mars orbit").click();

  await pauseAtEvent(page, "Mars orbit insertion failed");
  await expect(orbiterLabels(page)).toHaveCount(0);
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");

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

/** Plays the first Mission to its Turn summary, leaving the view alone unless told to keep switching. */
async function summaryAfterFirstTurn(
  page: Page,
  seed: number,
  keepSwitching: boolean,
): Promise<string> {
  await launchFirstMission(page, seed);
  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  let next: "Mars orbit" | "Solar system" = "Mars orbit";
  while (keepSwitching && (await summary.count()) === 0) {
    // The Turn may end before the click lands, which is fine.
    await viewButton(page, next)
      .click({ timeout: 500 })
      .catch(() => undefined);
    next = next === "Mars orbit" ? "Solar system" : "Mars orbit";
  }
  await expect(summary).toBeVisible();
  return (await summary.textContent()) ?? "";
}

test("gives the same results whichever view is showing", async ({ page }) => {
  const untouched = await summaryAfterFirstTurn(page, successSeed, false);
  await page.evaluate(() => {
    localStorage.clear();
  });
  const switched = await summaryAfterFirstTurn(page, successSeed, true);
  expect(untouched).toContain("First orbiter at Mars");
  expect(switched).toBe(untouched);
});

/** Where the camera is at each view's shot, as the scene reports it. */
const solarSystemCamera = "0.000 3.500 2.100";
const marsOrbitCamera = "0.000 4.000 -16.900";

/** Starts recording every position the camera takes from now on. */
async function recordCamera(page: Page): Promise<void> {
  await page
    .getByTestId("solar-system-view")
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const seen: string[] = [];
      Object.assign(window, { cameraPositions: seen });
      new MutationObserver(() => {
        const position = canvas.dataset.cameraPosition ?? "";
        if (seen.at(-1) !== position) seen.push(position);
      }).observe(canvas, {
        attributes: true,
        attributeFilter: ["data-camera-position"],
      });
    });
}

function recordedCamera(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { cameraPositions: string[] }).cameraPositions,
  );
}

function cameraPosition(page: Page) {
  return page.getByTestId("solar-system-view").locator("canvas");
}

/** The longest single step in the camera's path, as a share of the distance between the shots. */
function longestStep(positions: string[]): number {
  const points = positions.map((position) => position.split(" ").map(Number));
  const distance = (first: number[], second: number[]) =>
    Math.hypot(...first.map((value, index) => value - (second[index] ?? 0)));
  const between = distance(
    solarSystemCamera.split(" ").map(Number),
    marsOrbitCamera.split(" ").map(Number),
  );
  return Math.max(
    ...points
      .slice(1)
      .map((point, index) => distance(point, points[index] ?? point) / between),
  );
}

test("moves the view to Mars orbit on arrival, and leaves it where the player then puts it", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  const current = page.getByTestId("current-view");

  await pauseAtEvent(page, "Mars transfer burn");
  await expect(current).toHaveText("Solar system");

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(current).toHaveText("Mars orbit");
  await expect(orbiterLabels(page)).toHaveText(["Pathfinder Orbiter"]);

  // The player switches away, and it stays that way to the end of the Turn.
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await page.getByRole("button", { name: "5x" }).click();
  const summary = page.getByTestId("turn-summary");
  await expect
    .poll(async () => {
      const finished = await summary.count();
      if (finished === 0) {
        expect(await current.textContent()).toBe("Solar system");
      }
      return finished;
    })
    .toBe(1);
  expect(problems).toEqual([]);
});

test("moves the view to Mars orbit when orbit insertion fails", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, seedFailingAt("Mars orbit insertion"));
  await pauseAtEvent(page, "Mars orbit insertion failed");
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  expect(problems).toEqual([]);
});

for (const failedEvent of ["Launch", "Mars transfer burn"]) {
  test(`stays on the solar system when ${failedEvent} fails`, async ({
    page,
  }) => {
    await launchFirstMission(page, seedFailingAt(failedEvent));
    await pauseAtEvent(page, `${failedEvent} failed`);
    await expect(page.getByTestId("current-view")).toHaveText("Solar system");
    await page.getByRole("button", { name: "10x" }).click();
    await expect(page.getByTestId("turn-summary")).toBeVisible();
  });
}

test("a switch away holds until the next Mission Event with a view of its own", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Spaced out, because in real data these two are too close together to stop between at this test speed.
  await page.route("**/data/mission-events.json", async (route) => {
    const response = await route.fetch();
    const events = (await response.json()) as {
      id: string;
      timing: { days: number };
    }[];
    const landing = events.find(({ id }) => id === "entry-descent-landing");
    if (landing) landing.timing.days = 200;
    await route.fulfill({ json: events });
  });
  await page.goto(`/?seed=${orbiterSafeSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const current = page.getByTestId("current-view");

  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(current).toHaveText("Mars orbit");
  await viewButton(page, "Solar system").click();
  await expect(current).toHaveText("Solar system");
  await page.getByRole("button", { name: "1x" }).click();
  await expect(page.getByTestId("mission-date")).not.toHaveText("29 June 2029");
  await expect(current).toHaveText("Solar system");

  await pauseAtEvent(page, "Entry/descent/landing failed");
  await expect(current).toHaveText("Mars orbit");
  expect(problems).toEqual([]);
});

test("ends up on Mars orbit when several Mission Events pass at 10x", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterSafeSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("moves the camera smoothly while paused, and can be turned back partway", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, successSeed);
  await pauseAtEvent(page, "Launch");
  const camera = cameraPosition(page);
  await expect(camera).toHaveAttribute(
    "data-camera-position",
    solarSystemCamera,
  );
  const date = await page.getByTestId("mission-date").textContent();

  // A whole move, which pausing the game doesn't freeze.
  await recordCamera(page);
  await viewButton(page, "Mars orbit").click();
  await expect(camera).toHaveAttribute("data-camera-position", marsOrbitCamera);
  const there = await recordedCamera(page);
  expect(there.length).toBeGreaterThan(4);
  expect(longestStep([solarSystemCamera, ...there])).toBeLessThan(0.25);

  // Back again, turning round partway to Mars orbit.
  await viewButton(page, "Solar system").click();
  await expect(camera).toHaveAttribute(
    "data-camera-position",
    solarSystemCamera,
  );
  await viewButton(page, "Mars orbit").click();
  await expect
    .poll(async () => {
      const position = await camera.getAttribute("data-camera-position");
      return position !== solarSystemCamera;
    })
    .toBe(true);
  await viewButton(page, "Solar system").click();
  await expect(camera).toHaveAttribute(
    "data-camera-position",
    solarSystemCamera,
  );
  const positions = await recordedCamera(page);
  expect(
    longestStep([marsOrbitCamera, ...positions.slice(there.length)]),
  ).toBeLessThan(0.25);

  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");
  expect(problems).toEqual([]);
});

test("shows a lander coming down and then on the surface", async ({ page }) => {
  const problems = watchForProblems(page);
  // A small window, so that frames are quick enough not to skip past the landing at this test speed.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();

  // Pauses the moment the marker appears, which a click from out here would be too late for.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(function check() {
          const pause = [...document.querySelectorAll("button")].find(
            (button) => button.textContent === "Pause",
          );
          if (document.querySelector("[data-testid=mars-landing]") !== null) {
            pause?.click();
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        });
        // The view has to be showing for the marker to be there at all.
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Mars orbit")
          ?.click();
      }),
  );
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

test("shows a crash in red, in the Mars orbit view it moved to", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${crashSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Entry/descent/landing failed");
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  const crash = page.getByTestId("mars-landing");
  await expect(crash).toHaveText("Prospector Lander: crashed at Jezero Crater");
  await expect(crash).toHaveClass(/crashed-label/);
  await expect(crash).toBeVisible();
  await expect(page.getByTestId("mars-surface-asset")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

for (const size of [
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
]) {
  test(`keeps the view buttons on the one line of controls at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await launchFirstMission(page, successSeed);
    const bar = await page.locator(".mission-bar").boundingBox();
    const middle = (bar?.y ?? 0) + (bar?.height ?? 0) / 2;
    for (const control of [
      page.getByRole("heading", { name: "Mission Mode" }),
      viewButton(page, "Solar system"),
      viewButton(page, "Mars orbit"),
      page.getByRole("button", { name: "10x" }),
    ]) {
      const box = await control.boundingBox();
      expect(
        Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - middle),
      ).toBeLessThan(10);
    }
    const progress = await page
      .getByRole("progressbar", { name: "Progress through the Turn" })
      .boundingBox();
    expect(progress?.width).toBeGreaterThan(100);
  });
}
