import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { endTurnWithoutLaunching } from "./turnHelpers";
import { screenSizes } from "./layoutHelpers";
import { successSeed } from "./seeds";

const advice = (page: Page) => page.getByTestId("tutorial-advice");

async function startTutorial(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Turn on Tutorial mode" }).click();
  await expect(advice(page)).toBeVisible();
}

test("a Tutorial mode Program's first Planning session shows advice with reasons and its stage, and the advice changes after a Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await startTutorial(page, successSeed);
  await expect(page.getByTestId("tutorial-stage")).toContainText(
    "Stage 1 of 6: First orbiter",
  );
  const items = page.getByTestId("tutorial-items").locator("li");
  expect(await items.count()).toBeGreaterThan(0);
  await expect(page.locator(".tutorial-reason").first()).not.toBeEmpty();
  await expect(page.getByTestId("tutorial-change")).toHaveCount(0);
  // Text only: nothing in it fills in the plan.
  await expect(advice(page).getByRole("button")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  const firstAdvice = await advice(page).textContent();

  // Not following it: the next Turn's advice says so first.
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("tutorial-change")).toBeVisible();
  expect(await advice(page).textContent()).not.toEqual(firstAdvice);
  expect(problems).toEqual([]);
});

for (const size of screenSizes) {
  test(`at ${size.width}×${size.height} the advice leaves the plan's controls in view`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await startTutorial(page, successSeed);
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    for (const name of [
      "Launch Mission",
      "End Turn without launching",
      "Turn off Tutorial mode",
    ]) {
      await expect(page.getByRole("button", { name })).toBeInViewport({
        ratio: 1,
      });
    }
    const pageScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight > innerHeight ||
        document.documentElement.scrollWidth > innerWidth,
    );
    expect(pageScrolls).toBe(false);
  });
}

test("at 1920×1080 the whole of the first Turn's advice is in view without scrolling, and the route opens as a list, a stage a line", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startTutorial(page, successSeed);
  await chooseAssets(page, ["Pathfinder Orbiter"]);

  // Every line of it: the stage, each suggestion with its reason, and the note at its foot that it is only advice.
  const panel = page.getByTestId("tutorial-panel");
  const lines = await panel
    .locator("h3, p, li")
    .filter({ visible: true })
    .all();
  expect(lines.length).toBeGreaterThan(4);
  for (const line of lines) {
    await expect(line).toBeInViewport({ ratio: 1 });
  }
  const panelScrolls = await panel.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  expect(panelScrolls).toBe(false);

  // The route is one line until asked for, then a list with each stage on a line of its own.
  const stage = page.getByTestId("tutorial-stage");
  const route = stage.getByRole("list", { name: "The route" });
  await expect(route).toBeHidden();
  await stage.getByText("Show the route").click();
  await expect(route).toBeVisible();
  const stages = await route.getByRole("listitem").all();
  expect(stages).toHaveLength(6);
  const boxes = await Promise.all(stages.map((each) => each.boundingBox()));
  for (const [index, box] of boxes.entries()) {
    const before = boxes[index - 1];
    if (!box || !before) continue;
    expect(box.x).toBeCloseTo(before.x, 0);
    expect(box.y).toBeGreaterThanOrEqual(before.y + before.height - 1);
  }
  await expect(route.getByRole("listitem").first()).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(problems).toEqual([]);
});

test("at 1920×1080 the side column shows a cue while the advice pushes the panels under it out of sight", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startTutorial(page, successSeed);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByTestId("tutorial-stage").getByText("Show the route").click();
  const side = page.getByTestId("planning-side");
  const cue = side.locator(":scope > .scroll-cue");
  const more = await side.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  expect(more).toBe(true);
  await expect(cue).toHaveAttribute("data-more", "true");
  await side.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(cue).not.toHaveAttribute("data-more");
});
