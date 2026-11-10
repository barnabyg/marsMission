import { expect, test } from "@playwright/test";
import {
  listenForSounds,
  missionViewport,
  soundsHeard,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { eventEntries, pauseAtEvent, playToNextTurn } from "./playbackHelpers";
import { seedFailingAt, successSeed } from "./seeds";

test.use({ viewport: missionViewport });

for (const speed of ["1x", "10x"]) {
  test(`plays each sound with what is on screen at ${speed}`, async ({
    page,
  }) => {
    // Over 5 s: the 1x case plays every sound at 1x on purpose, because sounds have to match the screen at both speeds.
    await listenForSounds(page);
    const problems = watchForProblems(page);
    await page.goto(`/?seed=${successSeed}`);
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    await page.getByRole("button", { name: "Launch Mission" }).click();
    await page.getByRole("button", { name: speed }).click();
    // Once the last sound has played, the rest of the Turn plays at 10x, which would still hear any sound after it.
    await expect
      .poll(async () => (await soundsHeard(page)).length, { intervals: [100] })
      .toBeGreaterThanOrEqual(3);
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === "10x")
        ?.click();
    });
    await expect(page.getByTestId("turn-summary")).toBeVisible();

    const heard = await soundsHeard(page);
    expect(heard.map(([file]) => file)).toEqual([
      "launch.wav",
      "milestone.wav",
      "funding-threshold.wav",
    ]);
    expect(heard[0]?.[1]).toContain("Launch");
    expect(heard[0]?.[1]).not.toContain("First orbiter at Mars");
    expect(heard[1]?.[1]).toContain("First orbiter at Mars");
    expect(heard[2]?.[1]).toContain("Funding Threshold reached");
    expect(problems).toEqual([]);
  });
}

test("plays the failure sound when a Mission Event fails", async ({ page }) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(eventEntries(page).first().getByRole("heading")).toHaveText(
    "Launch failed",
  );
  const heard = await soundsHeard(page);
  expect(heard.map(([file]) => file)).toEqual(["failure.wav"]);
  expect(heard[0]?.[1]).toContain("Launch failed");
});

test("stays silent for the rest of a Turn after muting partway through", async ({
  page,
}) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await page.getByRole("button", { name: "Mute sound" }).click();
  await playToNextTurn(page);
  // Only the launch, which played before muting.
  expect((await soundsHeard(page)).map(([file]) => file)).toEqual([
    "launch.wav",
  ]);
});

test("plays no sounds for what skipping to the Turn summary skips", async ({
  page,
}) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await page.getByRole("button", { name: /^Skip to / }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  expect((await soundsHeard(page)).map(([file]) => file)).toEqual([
    "launch.wav",
  ]);
});

test("remembers the mute setting after the browser closes", async ({
  page,
}) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(eventEntries(page).first()).toBeVisible();

  const mute = page.getByRole("button", { name: "Mute sound" });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("button", { name: "Mute sound" }),
  ).toHaveAttribute("aria-pressed", "true");
  // The launch sound would start as its entry shows.
  await expect(eventEntries(page).first()).toBeVisible();
  expect(await soundsHeard(page)).toEqual([]);
});

test("keeps playing when the sound files can't be loaded", async ({ page }) => {
  await page.route("**/sounds/*", (route) => route.abort());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  expect(errors).toEqual([]);
});
