import { expect, test, type Page } from "@playwright/test";
import {
  eventEntries,
  pauseAtEvent,
  playToNextTurn,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

/** Records each sound as it starts, with what the events column shows at that moment. */
async function listenForSounds(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[][] = [];
    (window as unknown as { soundLog: string[][] }).soundLog = log;
    const play: () => Promise<void> = Reflect.get(
      HTMLMediaElement.prototype,
      "play",
    );
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      log.push([
        this.src.split("/").at(-1) ?? "",
        document.querySelector("[data-testid=events-column]")?.textContent ??
          "",
      ]);
      return play.call(this);
    };
  });
}

function soundsHeard(page: Page): Promise<string[][]> {
  return page.evaluate(
    () => (window as unknown as { soundLog: string[][] }).soundLog,
  );
}

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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Launch");
  await page.getByRole("button", { name: "Mute sound" }).click();
  await playToNextTurn(page);
  // Only the launch, which played before muting.
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
  // Over 5 s: watches a whole Turn, to show that missing sounds never stop it.
  await page.route("**/sounds/*", (route) => route.abort());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  expect(errors).toEqual([]);
});
