import { expect, test } from "@playwright/test";
import {
  eventEntries,
  listenForSounds,
  pauseAtEvent,
  playToNextTurn,
  soundsHeard,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

for (const speed of ["1x", "10x"]) {
  test(`plays each sound with what is on screen at ${speed}`, async ({
    page,
  }) => {
    // Over 5 s: the 1x case watches a whole Turn on purpose, because sounds have to match the screen at both speeds.
    await listenForSounds(page);
    const problems = watchForProblems(page);
    await page.goto(`/?seed=${successSeed}`);
    await page.getByRole("button", { name: "Launch Mission" }).click();
    await page.getByRole("button", { name: speed }).click();
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

test("plays no sounds for what End Turn skips", async ({ page }) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${successSeed}`);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(eventEntries(page).first()).toBeVisible();

  const mute = page.getByRole("button", { name: "Mute sound" });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  expect(errors).toEqual([]);
});
