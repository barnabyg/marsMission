import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  holdSequence,
  holdTurnWhenShown,
  surfaceAssets,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import { landingSeed, roverSeed } from "./seeds";

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
