import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  fourKViewport,
  missionViewport,
  pauseAtEvent,
  pauseAtEventAfter,
  playToNextTurn,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

test.use({ viewport: missionViewport });

// Mission Mode's playback controls and the events column beside the view.

test("pauses Mission Mode and resumes from exactly where it stopped, without carrying into the next Turn", async ({
  page,
}) => {
  // Over 5 s: this tests playback itself, across a whole Turn and into the next.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const current = page.getByTestId("current-speed");
  await expect(current).toHaveText("1x");

  const speed = page.getByRole("group", { name: "Speed" });
  await expect(speed.getByRole("button")).toHaveText([
    "Pause",
    "1x",
    "5x",
    "10x",
  ]);
  const date = page.getByTestId("mission-date");
  const journey = page.getByTestId("journey-progress");
  const turnProgress = page.getByRole("progressbar");

  await speed.getByRole("button", { name: "5x" }).click();
  await speed.getByRole("button", { name: "Pause" }).click();
  await expect(current).toHaveText("Paused");
  await expect(speed.getByRole("button", { name: "Pause" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(speed.getByRole("button", { name: "5x" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const held = {
    date: await date.textContent(),
    journey: await journey.textContent(),
    turn: await turnProgress.getAttribute("value"),
  };
  await page.waitForTimeout(500);
  expect(await date.textContent()).toBe(held.date);
  expect(await journey.textContent()).toBe(held.journey);
  expect(await turnProgress.getAttribute("value")).toBe(held.turn);

  // Mute still works.
  const mute = page.getByRole("button", { name: "Mute sound" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(current).toHaveText("Paused");
  await mute.click();

  await speed.getByRole("button", { name: "10x" }).click();
  await expect(current).toHaveText("10x");
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  // The next Turn starts at the speed last chosen.
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(current).toHaveText("10x");
  expect(problems).toEqual([]);
});

test("keeps the events column beside the solar system view, scrolling by itself if it fills", async ({
  page,
}) => {
  // Checks where things sit on screen, at the size this was laid out for.
  await page.setViewportSize(fourKViewport);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );

  const column = page.getByTestId("events-column");
  const scene = page.getByTestId("mission-scene");
  await expect(scene.locator("canvas")).toBeVisible();
  const columnBox = await column.boundingBox();
  const sceneBox = await scene.boundingBox();
  expect(sceneBox?.x).toBe(0);
  expect((sceneBox?.x ?? 0) + (sceneBox?.width ?? 0)).toBeCloseTo(
    columnBox?.x ?? 0,
  );
  expect((columnBox?.x ?? 0) + (columnBox?.width ?? 0)).toBeCloseTo(3840);

  // Fast to three months before it, so the hold lands on its day and no later event slips in.
  await pauseAtEventAfter(
    page,
    "Funding Threshold reached: 250 Public Support",
    "1 April 2029",
  );
  await page.setViewportSize({ width: 2560, height: 400 });
  const entries = page.getByTestId("event-entries");
  await expect
    .poll(() =>
      entries.evaluate((list) => list.scrollHeight > list.clientHeight),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(false);
  await expect(column).toBeInViewport({ ratio: 1 });
});
