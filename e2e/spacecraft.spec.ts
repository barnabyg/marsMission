import { expect, test, type Page } from "@playwright/test";
import {
  holdTurnWhenShown,
  pauseAtEvent,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, solarParticleEventSeed, successSeed } from "./seeds";

/** Where the camera is at the spacecraft view's shot, as the scene reports it. */
const spacecraftCamera = "-13.400 1.800 2.400";

const unavailable = "Spacecraft view: no Mission is in flight.";

function currentView(page: Page) {
  return page.getByTestId("current-view");
}

function scene(page: Page) {
  return page.getByTestId("solar-system-view");
}

function carried(page: Page) {
  return page.getByTestId("spacecraft-asset");
}

async function expectSpacecraftUnavailable(page: Page): Promise<void> {
  await expect(viewButton(page, "Spacecraft")).toBeDisabled();
  await expect(page.getByTestId("spacecraft-unavailable")).toHaveText(
    unavailable,
  );
  await expect(viewButton(page, "Spacecraft")).toHaveAccessibleDescription(
    unavailable,
  );
}

test("switches to the spacecraft view by hand on the way to Mars, and moves on once the Mission arrives", async ({
  page,
}) => {
  // Over 5 s: plays at 1x from launch to the arrival, which is what the view moves on from.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(page.getByTestId("spacecraft-unavailable")).toHaveCount(0);

  // The camera eases across in steps, rather than jumping.
  const canvas = scene(page).locator("canvas");
  await expect(canvas).toHaveAttribute("data-camera-position", /\d/);
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const seen: string[] = [];
    Object.assign(window, { cameraPositions: seen });
    new MutationObserver(() => {
      seen.push(element.dataset.cameraPosition ?? "");
    }).observe(element, {
      attributes: true,
      attributeFilter: ["data-camera-position"],
    });
  });
  await viewButton(page, "Spacecraft").click();
  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(viewButton(page, "Spacecraft")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveAttribute(
    "data-camera-position",
    spacecraftCamera,
  );
  const path = await page.evaluate(
    () => (window as unknown as { cameraPositions: string[] }).cameraPositions,
  );
  expect(new Set(path).size).toBeGreaterThan(4);

  await expect(carried(page)).toHaveText(["Pathfinder Orbiter"]);
  await expect(carried(page)).toBeVisible();
  await expect(page.getByTestId("spacecraft-status")).toHaveText(
    "Pathfinder Orbiter (orbiter)",
  );
  await expect(scene(page)).not.toHaveAttribute(
    "data-solar-particle-event",
    /./,
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Mars orbit insertion");
  await expect(currentView(page)).toHaveText("Mars orbit");
  await expectSpacecraftUnavailable(page);
  await expect(carried(page)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("isn't available in a Turn with no Mission", async ({ page }) => {
  await page.goto(`/?seed=${successSeed}`);
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expectSpacecraftUnavailable(page);
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

for (const reachedBy of ["10x", "End Turn"] as const) {
  test(`moves to the spacecraft view for a solar particle event, reached by ${reachedBy}, and respects a later choice`, async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await page.goto(`/?seed=${solarParticleEventSeed}`);
    // Held from the start, as the event comes too soon after launch at this test speed for a click to beat it.
    await holdTurnWhenShown(page);
    await page.getByRole("button", { name: "Launch Mission" }).click();
    await expect(page.getByTestId("current-speed")).toHaveText("Paused");
    await page.getByRole("button", { name: reachedBy, exact: true }).click();
    const decisionPoint = page.getByTestId("decision-point");
    await expect(decisionPoint).toBeVisible();

    await expect(currentView(page)).toHaveText("Spacecraft");
    await expect(scene(page)).toHaveAttribute(
      "data-solar-particle-event",
      "showing",
    );
    await expect(carried(page)).toHaveText(["Pathfinder Orbiter"]);
    await expect(page.getByTestId("spacecraft-status")).toContainText(
      "Solar particle event",
    );
    expect(await termsWithoutTooltips(page)).toEqual([]);

    // Waiting for an answer holds it all, for as long as it takes.
    await page.waitForTimeout(7000);
    await expect(currentView(page)).toHaveText("Spacecraft");
    await expect(scene(page)).toHaveAttribute(
      "data-solar-particle-event",
      "showing",
    );

    // The player looks elsewhere, and their answer doesn't pull them back.
    await viewButton(page, "Solar system").click();
    await expect(currentView(page)).toHaveText("Solar system");
    await decisionPoint.getByRole("button", { name: "Safe mode" }).click();
    await expect(
      page.getByRole("heading", { name: "Solar particle event: safe mode" }),
    ).toBeVisible();
    await expect(currentView(page)).toHaveText("Solar system");
    expect(problems).toEqual([]);
  });
}

test("moves to the spacecraft view when the transfer burn fails, and then on to the solar system", async ({
  page,
}) => {
  // Over 5 s: holds the failure for a while, then plays at 1x for the few seconds it stays on screen.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${seedFailingAt("Mars transfer burn")}`);
  await holdTurnWhenShown(page, "Mars transfer burn failed");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(page.getByTestId("spacecraft-lost")).toHaveText([
    "Pathfinder Orbiter: lost",
  ]);
  await expect(carried(page)).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Pausing holds it on screen.
  await page.waitForTimeout(5000);
  await expect(currentView(page)).toHaveText("Spacecraft");

  await page.getByRole("button", { name: "1x" }).click();
  await expect(currentView(page)).toHaveText("Solar system");
  await expect(page.getByTestId("turn-summary")).toHaveCount(0);
  await expectSpacecraftUnavailable(page);
  expect(problems).toEqual([]);
});
