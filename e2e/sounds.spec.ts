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

for (const speed of ["1x", "20x"]) {
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

test("holds ignition while paused and sounds the breakup on the failed flight", async ({
  page,
}) => {
  await listenForSounds(page);
  await page.goto(`/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch failed", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  expect(await soundsHeard(page)).toEqual([]);
  await page.getByRole("button", { name: "20x", exact: true }).click();
  await expect.poll(async () => (await soundsHeard(page)).length).toBe(2);
  const heard = await soundsHeard(page);
  expect(heard.map(([file]) => file)).toEqual(["launch.wav", "failure.wav"]);
  const [ignition, breakup] = heard.map(([, , ms]) => Number(ms));
  expect(ignition).toBeGreaterThanOrEqual(1550);
  expect(ignition).toBeLessThan(2300);
  expect(breakup).toBeGreaterThanOrEqual(6500);
  expect(breakup).toBeLessThan(9000);
  expect(heard[0]?.[1]).toContain("Launch failed");
});

test("pauses the ignition sample in place and resumes it before skipping the scene", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play: () => Promise<void> = Reflect.get(
      HTMLMediaElement.prototype,
      "play",
    );
    let observed = false;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!observed && this.src.endsWith("/launch.wav")) {
        observed = true;
        Object.assign(window, {
          readIgnition: () => ({
            paused: this.paused,
            time: this.currentTime,
          }),
        });
        const hold = () => {
          if (this.currentTime < 0.08) {
            requestAnimationFrame(hold);
            return;
          }
          document
            .querySelector<HTMLButtonElement>('button[title^="Pause."]')
            ?.click();
        };
        requestAnimationFrame(hold);
      }
      return play.call(this);
    };
  });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  const read = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          readIgnition: () => { paused: boolean; time: number };
        }
      ).readIgnition(),
    );
  const held = await read();
  expect(held.paused).toBe(true);
  expect(held.time).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  expect(await read()).toEqual(held);
  await page.getByRole("button", { name: "20x", exact: true }).click();
  await expect.poll(async () => (await read()).time).toBeGreaterThan(held.time);
  await page.getByRole("button", { name: "Skip launch scene" }).click();
  expect((await read()).paused).toBe(true);
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
  expect(await soundsHeard(page)).toEqual([]);
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
  expect(await soundsHeard(page)).toEqual([]);
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
  // Run past ignition with the remembered setting.
  await playToNextTurn(page);
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
