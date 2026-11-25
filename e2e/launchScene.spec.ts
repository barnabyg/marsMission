import { expect, test } from "@playwright/test";
import { missionViewport, watchForProblems } from "./helpers";
import {
  colossusBuiltSave,
  colossusMoney,
  colossusSeed,
} from "./colossusSeeds";
import { chooseAssets } from "./planningHelpers";
import { continueFromSave, overrideProgramData } from "./saveHelpers";
import { launchFirstMission, launchHeld, viewButton } from "./playbackHelpers";
import { seedFailingAt, successSeed } from "./seeds";
import { sequenceTimeScale } from "../playwright.config";

test.use({ viewport: missionViewport });

test("a cold scene load still opens on the pad", async ({ page }) => {
  let releaseScene!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseScene = resolve;
  });
  await page.route("**/src/mission/MissionScene.tsx*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("button", { name: "Skip launch scene" }),
  ).toBeVisible();
  // Hold the module past the entire nine-second launch, with the suite's accelerated clock.
  await page.waitForTimeout(10_000 / sequenceTimeScale);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  releaseScene();
  await expect(
    page.getByTestId("mission-scene").locator("canvas"),
  ).toHaveAttribute("data-launch-frame", "pad");
  await expect(page.getByTestId("mission-scene")).toHaveAttribute(
    "data-launch-ms",
    "0",
  );
});

for (const vehicle of [
  "meridian-medium",
  "meridian-heavy",
  "meridian-colossus",
]) {
  test(`shows ${vehicle} on the common launch pad and dismisses the shot while paused`, async ({
    page,
  }, info) => {
    const problems = watchForProblems(page);
    await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
    await continueFromSave(page, colossusBuiltSave(colossusSeed));
    await page
      .getByRole("combobox", { name: "Launch Vehicle" })
      .selectOption(vehicle);
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    await launchHeld(page);
    const scene = page.getByTestId("mission-scene");
    await expect(scene).toHaveAttribute("data-launch-vehicle", vehicle);
    await expect(scene.locator("canvas")).toHaveAttribute(
      "data-launch-frame",
      "pad",
    );
    const elapsed = await scene.getAttribute("data-launch-ms");
    await info.attach(vehicle, {
      body: await scene.screenshot(),
      contentType: "image/png",
    });
    await expect(scene).toHaveAttribute("data-launch-ms", elapsed ?? "");
    await viewButton(page, "Mars orbit").click();
    await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
    await viewButton(page, "Solar system").click();
    await expect(scene).not.toHaveAttribute("data-launch-vehicle", /.+/);
    await expect(page.getByTestId("current-speed")).toHaveText("Paused");
    expect(problems).toEqual([]);
  });
}

test("a failed launch climbs and breaks up before the scene ends", async ({
  page,
}, info) => {
  const problems = watchForProblems(page);
  await launchFirstMission(page, seedFailingAt("Launch"), "Launch failed");
  const scene = page.getByTestId("mission-scene");
  const canvas = scene.locator("canvas");
  await expect(canvas).toHaveAttribute("data-launch-frame", "pad");
  const cameraHeight = async () =>
    Number((await canvas.getAttribute("data-camera-position"))?.split(" ")[1]);
  const padHeight = await cameraHeight();
  expect(padHeight).toBeGreaterThan(0);
  // Pause inside the page on the first breakup frame, even if the screenshot takes longer than the shot.
  await canvas.evaluate((element) => {
    const observer = new MutationObserver(() => {
      if (element.getAttribute("data-launch-frame") !== "breakup") return;
      observer.disconnect();
      document
        .querySelector<HTMLButtonElement>('button[title^="Pause."]')
        ?.click();
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-launch-frame"],
    });
  });
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect.poll(cameraHeight).toBeLessThan(padHeight);
  await expect(canvas).toHaveAttribute("data-launch-frame", "ascent");
  await expect(canvas).toHaveAttribute("data-launch-frame", "breakup");
  expect(await cameraHeight()).toBeGreaterThan(padHeight);
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await info.attach("breakup", {
    body: await scene.screenshot(),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect(scene).not.toHaveAttribute("data-launch-vehicle", /.+/);
  expect(problems).toEqual([]);
});

test("returning to the map after a failed transfer burn leaves launch behind", async ({
  page,
}) => {
  await launchFirstMission(
    page,
    seedFailingAt("Mars transfer burn"),
    "Mars transfer burn failed",
  );
  const view = page.getByTestId("current-view");
  await expect(view).toHaveText("Spacecraft");
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect(view).toHaveText("Solar system");
  // An immediate read catches launch reappearing briefly before its own clock expires.
  expect(
    await page.getByTestId("mission-scene").getAttribute("data-launch-vehicle"),
  ).toBeNull();
});
