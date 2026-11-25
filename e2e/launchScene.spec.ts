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
import { seedFailingAt } from "./seeds";

test.use({ viewport: missionViewport });

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
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-launch-frame", "ascent");
  await expect(canvas).toHaveAttribute("data-launch-frame", "breakup");
  await info.attach("breakup", {
    body: await scene.screenshot(),
    contentType: "image/png",
  });
  await expect(scene).not.toHaveAttribute("data-launch-vehicle", /.+/);
  expect(problems).toEqual([]);
});
