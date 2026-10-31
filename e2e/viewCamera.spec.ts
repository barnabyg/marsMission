import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  launchFirstMission,
  orbiterLabels,
  pauseAtEvent,
  viewButton,
  watchForProblems,
} from "./helpers";
import { orbiterSafeSeed, seedFailingAt, successSeed } from "./seeds";

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
  // Over 5 s: stops at two points at 1x, then checks the view for the rest of the Turn.
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
  // Over 5 s: waits at 1x for the failure so the pause lands in time.
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
    // Over 5 s: for a later Mission Event, waits at 1x for the failure so the pause lands in time, then plays out the Turn.
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
  // Over 5 s: waits at 1x between two Mission Events, which is what the switch has to hold across.
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
  await expect(current).toHaveText("Surface");
  expect(problems).toEqual([]);
});

test("ends up on the surface when several Mission Events pass at 10x", async ({
  page,
}) => {
  // Over 5 s: plays out a whole Turn, which is what the test is about.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterSafeSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  await page.getByLabel("Launch Vehicle").selectOption("meridian-heavy");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect(problems).toEqual([]);
});

test("moves the camera smoothly while paused, and can be turned back partway", async ({
  page,
}) => {
  // Over 5 s: camera moves take real time at any speed, and this makes several.
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
