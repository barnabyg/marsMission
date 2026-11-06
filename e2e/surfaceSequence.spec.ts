import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  fourKViewport,
  holdSequence,
  holdTurnWhenShown,
  launchHeld,
  missionViewport,
  playFastUntil,
  surfaceAssets,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import { landingSeed, roverSeed } from "./seeds";

test.use({ viewport: missionViewport });

/** Where the camera is at the surface view's usual shot, as the scene reports it. */
const surfaceCamera = "0.000 2.200 12.500";

function scene(page: Page) {
  return page.getByTestId("mission-scene");
}

/** Launches a lander, holding the Turn as Mission Mode opens. */
async function launchLanding(page: Page): Promise<void> {
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await launchHeld(page);
}

/**
 * Plays on to the landing on 4 July 2029, quickly until a few months before it and then at 1x, which leaves the Turn
 * time enough for the whole landing.
 */
function playToLanding(page: Page): Promise<void> {
  return playFastUntil(page, "25 March 2029");
}

function playedMs(page: Page) {
  return scene(page)
    .getAttribute("data-sequence-ms")
    .then((value) => Number(value));
}

test("moves the view to the surface for a landing at 3840×2160, with a smooth camera move and the landing playing", async ({
  page,
}) => {
  await page.setViewportSize(fourKViewport);
  // Over 5 s: a landing takes the same real time as it would in play.
  const problems = watchForProblems(page);
  await launchLanding(page);
  const canvas = scene(page).locator("canvas");
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
  await playToLanding(page);

  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(scene(page)).toHaveAttribute("data-sequence", "landing");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Landing: Prospector Lander",
  );
  await expect(surfaceAssets(page)).toHaveText(["Prospector Lander"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await holdSequence(page);
  await expect(canvas).toHaveAttribute("data-camera-position", surfaceCamera);
  await expect(scene(page)).not.toHaveAttribute("data-sequence");
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
  const playing = holdSequence(page, 1000);
  await playToLanding(page);
  await playing;

  // Paused, it stands still in real time.
  const held = await playedMs(page);
  const date = await page.getByTestId("mission-date").textContent();
  await page.waitForTimeout(800);
  expect(await playedMs(page)).toBe(held);
  await expect(page.getByTestId("mission-date")).toHaveText(date ?? "");

  // At a new speed, it goes on from where it was. Paused from inside the page as soon as it moves on, because at 5x a
  // click from out here can come after the Turn ends. If the landing ends first, the check after this fails at once.
  const resumed = await page.evaluate(
    (start) =>
      new Promise<number>((resolve) => {
        const button = (name: string) =>
          [...document.querySelectorAll("button")].find(
            (button) => button.textContent === name,
          );
        button("5x")?.click();
        requestAnimationFrame(function check() {
          const played = document.querySelector<HTMLElement>(
            "[data-testid=mission-scene]",
          )?.dataset.sequenceMs;
          if (played !== undefined && Number(played) <= start) {
            requestAnimationFrame(check);
            return;
          }
          button("Pause")?.click();
          resolve(Number(played ?? -1));
        });
      }),
    held,
  );
  expect(resumed).toBeGreaterThan(held);
  expect(resumed).toBeLessThan(held + 3000);
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
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
  await expect(scene(page)).not.toHaveAttribute("data-sequence");
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
  const playing = holdSequence(page, 500);
  await playToLanding(page);
  await playing;
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
  await expect(scene(page)).not.toHaveAttribute("data-sequence");
  await expect(current).toHaveText("Mars orbit");
  expect(problems).toEqual([]);
});

/** Waits until the page has drawn this many more frames. */
function framesDrawn(page: Page, count: number): Promise<void> {
  return page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let left = frames;
        requestAnimationFrame(function check() {
          left -= 1;
          if (left > 0) requestAnimationFrame(check);
          else resolve();
        });
      }),
    count,
  );
}

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
  await launchHeld(page);
  const landed = holdSequence(page);
  await playToLanding(page);
  await landed;
  // Only once the camera has stopped can a moving label be down to the rover.
  await expect(scene(page).locator("canvas")).toHaveAttribute(
    "data-camera-position",
    surfaceCamera,
  );
  const label = surfaceAssets(page);
  await expect(label).toHaveClass(/rover-label/);
  const place = () => label.evaluate((element) => element.style.transform);

  const before = await place();
  // Paused from inside the page as soon as the label moves, because a click from out here can come after the Turn ends.
  // If the label goes first, the Turn has ended, and the check after this fails at once.
  const labelMoved = page.evaluate(
    (start) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(function check() {
          const label = document.querySelector<HTMLElement>(
            "[data-testid=surface-asset]",
          );
          if (label?.style.transform === start) {
            requestAnimationFrame(check);
            return;
          }
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent === "Pause")
            ?.click();
          resolve();
        });
      }),
    before,
  );
  await page.getByRole("button", { name: "1x" }).click();
  await labelMoved;
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  // A label moves in the frame after its day, and on a slow renderer one frame outlasts any fixed wait.
  await framesDrawn(page, 5);
  const moved = await place();
  await framesDrawn(page, 5);
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
  const views = [
    "Surface",
    "Mars orbit",
    "Spacecraft",
    "Solar system",
  ] as const;
  let next = 0;
  while (keepSwitching && (await summary.count()) === 0) {
    // The Turn may end before the click lands, or the view may have nothing to show by then, which is fine.
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
