import { expect, test } from "@playwright/test";
import {
  colossusBuiltSave,
  colossusMoney,
  colossusSeed,
} from "./colossusSeeds";
import { missionViewport } from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { launchHeld, pauseAtEvent, viewButton } from "./playbackHelpers";
import { continueFromSave, overrideProgramData } from "./saveHelpers";
import { successSeed } from "./seeds";

test.use({ viewport: missionViewport });

test("plays the Colossus launch, tanker and rendezvous in order at 20x and hands off to the summary", async ({
  page,
}) => {
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, colossusBuiltSave(colossusSeed));
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await chooseAssets(page, [
    "Pathfinder Orbiter",
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  await launchHeld(page);
  const scene = page.getByTestId("mission-scene");
  await expect(scene).toHaveAttribute(
    "data-launch-vehicle",
    "meridian-colossus",
  );
  const fast = page.getByRole("button", { name: "20x", exact: true });
  await pauseAtEvent(page, "Tanker launch", () => fast.click());
  await expect(scene).toHaveAttribute("data-earth-orbit", "tankerClimbing");
  await expect(
    page.getByRole("heading", { name: "Rendezvous", exact: true }),
  ).toHaveCount(0);
  await viewButton(page, "Mars orbit").click();
  await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
  await page.getByRole("button", { name: "Skip scene", exact: true }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await pauseAtEvent(page, "Rendezvous", () => fast.click());
  await expect(scene).toHaveAttribute("data-earth-orbit", "approaching");
  await fast.click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  await expect(page.getByTestId("summary-mission-event")).toContainText([
    /^Launch/,
    /^Tanker launch/,
    /^Rendezvous/,
  ]);
});

test("follows reduced motion through liftoff and remembers a player's camera override", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await launchHeld(page);
  const steady = page.getByRole("button", { name: "Steady camera" });
  await expect(steady).toHaveAttribute("aria-pressed", "true");
  const canvas = page.getByTestId("mission-scene").locator("canvas");
  await expect(canvas).toHaveAttribute("data-launch-frame", "pad");
  const padCamera = await canvas.getAttribute("data-camera-position");
  expect(padCamera).toBeTruthy();
  await page.getByRole("button", { name: "1x", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-launch-frame", "ascent");
  await expect(canvas).toHaveAttribute("data-camera-position", padCamera ?? "");
  await steady.click();
  await expect(steady).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await launchHeld(page);
  await expect(steady).toHaveAttribute("aria-pressed", "false");
});
