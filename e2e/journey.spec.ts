import { expect, test } from "@playwright/test";
import { productionBaseURL } from "../playwright.config";
import {
  cancelledAfterOneTurn,
  chooseAssets,
  eventEntries,
  overrideProgramData,
  pauseAtEvent,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

test("plays from a new Program through a launch to the next Turn", async ({
  page,
}) => {
  // Over 5 s: a whole journey into the next Turn, stopping at two points at 1x because at higher speeds the click to pause can land too late.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(page.getByTestId("launch-window")).toHaveText("December 2028");
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1B at 250 (150 away)",
  );

  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();

  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("current-speed")).toHaveText("1x");
  await pauseAtEvent(page, "Launch");

  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  await expect(eventEntries(page).last()).toContainText("1 December 2028");
  await expect(eventEntries(page).last()).toContainText("carries the Mission");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Nothing needs dismissing, so time just carries on when a speed is chosen.
  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Funding Threshold reached: 250 Public Support");
  await expect(eventEntries(page).getByRole("heading")).toHaveText([
    "Funding Threshold reached: 250 Public Support",
    "Survey from orbit",
    "First orbiter at Mars",
    "Mars orbit insertion",
    "Mars transfer burn",
    "Launch",
  ]);
  await expect(eventEntries(page).first()).toContainText("29 June 2029");
  await expect(eventEntries(page).first()).toContainText("pay out $1B");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(page.getByTestId("journey-progress")).toHaveText(
    /Pathfinder Orbiter: arrived at Mars/,
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter",
  );

  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("current-speed")).not.toHaveText("Paused");

  const summary = page.getByTestId("turn-summary");
  await expect(summary).toContainText("First orbiter at Mars");
  await expect(summary).toContainText("100 Science");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(summary.getByTestId("summary-funding-payouts")).toContainText(
    "$1B",
  );
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("science")).toHaveText("100");
  await expect(page.getByTestId("public-support")).toHaveText("255");
  await expect(page.getByTestId("milestones")).toContainText(
    "First orbiter at Mars",
  );
  await expect(page.getByTestId("launch-window")).toHaveText("January 2031");
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1.5B at 425 (170 away)",
  );
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("10x");
  expect(problems).toEqual([]);
});

for (const { missionEvent, before } of [
  { missionEvent: "Launch", before: [] },
  { missionEvent: "Mars transfer burn", before: ["Launch"] },
  {
    missionEvent: "Mars orbit insertion",
    before: ["Launch", "Mars transfer burn"],
  },
]) {
  test(`plays a Mission that fails at ${missionEvent} through to the next Turn`, async ({
    page,
  }) => {
    // Over 5 s: for a later Mission Event, waits at 1x for the failure so the pause lands before the Turn ends, then plays on to the next Turn.
    const problems = watchForProblems(page);
    await page.goto(`/?seed=${seedFailingAt(missionEvent)}`);
    await page.getByRole("button", { name: "Launch Mission" }).click();

    await pauseAtEvent(page, `${missionEvent} failed`);
    const failedEntry = eventEntries(page).first();
    await expect(eventEntries(page).getByRole("heading")).toHaveText([
      `${missionEvent} failed`,
      ...[...before].reverse(),
    ]);
    await expect(failedEntry).toHaveClass(/failed/);
    await expect(failedEntry).toContainText("Lost with the Mission");
    await expect(failedEntry).toContainText("Pathfinder Orbiter");
    await expect(failedEntry.getByRole("heading")).toHaveCSS(
      "color",
      "rgb(255, 143, 122)",
    );
    expect(await termsWithoutTooltips(page)).toEqual([]);
    await expect(page.getByTestId("journey-progress")).toHaveText(
      /lost, and will not reach Mars/,
    );
    await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
    await page.getByRole("button", { name: "10x" }).click();

    const summary = page.getByTestId("turn-summary");
    await expect(summary).toBeVisible();
    const failure = summary.getByTestId("summary-failure");
    await expect(failure).toContainText(missionEvent);
    await expect(failure).toContainText("Pathfinder Orbiter");
    await expect(failure).toContainText("Public Support lost: 20");
    expect(await termsWithoutTooltips(page)).toEqual([]);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("turn-number")).toHaveText("2");
    await expect(page.getByTestId("public-support")).toHaveText("68");
    await expect(page.getByTestId("science")).toHaveText("0");
    await expect(page.getByTestId("money")).toHaveText("$1.3B");
    await expect(page.getByTestId("operating-assets")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}

test("uses a known seed in a production build, as the playtest command runs it", async ({
  page,
}) => {
  await page.goto(`${productionBaseURL}/?seed=${seedFailingAt("Launch")}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(eventEntries(page).first().getByRole("heading")).toHaveText(
    "Launch failed",
  );
});

test("loads the data files, Mission Mode's view and its art from a production build", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const artTypes: (string | undefined)[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/art/")) {
      artTypes.push(response.headers()["content-type"]);
    }
  });
  await page.goto(`${productionBaseURL}/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
  // A failed file is only reported once its request ends, which can be after the canvas appears.
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
  // For a missing file, vite preview sends the game's page with status 200, and the browser reports no problem.
  expect(artTypes).toEqual(["image/jpeg", "image/jpeg"]);
});

test("pauses Mission Mode and resumes from exactly where it stopped, without carrying into the next Turn", async ({
  page,
}) => {
  // Over 5 s: this tests playback itself, across a whole Turn and into the next.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  const speed = page.getByRole("group", { name: "Speed" });
  await expect(speed.getByRole("button")).toHaveText([
    "Pause",
    "1x",
    "5x",
    "10x",
  ]);
  const current = page.getByTestId("current-speed");
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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(current).toHaveText("10x");
  expect(problems).toEqual([]);
});

test("keeps the events column beside the solar system view, scrolling by itself if it fills", async ({
  page,
}) => {
  // Over 5 s: waits at 1x for the Funding Threshold so the pause lands in time, with enough entries to fill the column.
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Launch");

  const column = page.getByTestId("events-column");
  const view = page.getByTestId("solar-system-view");
  await expect(view.locator("canvas")).toBeVisible();
  const columnBox = await column.boundingBox();
  const viewBox = await view.boundingBox();
  expect(viewBox?.x).toBe(0);
  expect((viewBox?.x ?? 0) + (viewBox?.width ?? 0)).toBeCloseTo(
    columnBox?.x ?? 0,
  );
  expect((columnBox?.x ?? 0) + (columnBox?.width ?? 0)).toBeCloseTo(3840);

  await page.getByRole("button", { name: "1x" }).click();
  await pauseAtEvent(page, "Funding Threshold reached: 250 Public Support");
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

test("lists the planned Mission's Mission Events with rough risk bands, which change with what it carries", async ({
  page,
}) => {
  await page.route("**/data/assets.json", async (route) => {
    const response = await route.fetch();
    const assets = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: [
        ...assets,
        {
          id: "test-probe",
          name: "Flyby Probe",
          kind: "orbiter",
          costMillions: 100,
          massTonnes: 1,
          serviceLifeOptions: [{ days: 900, costMillions: 0 }],
          failureChancePerTurn: 0,
          missionEvents: [],
        },
      ],
    });
  });
  await page.goto("/");

  const events = page.getByTestId("mission-event");
  await expect(events).toHaveCount(3);
  await expect(events.nth(0)).toContainText("Launch");
  await expect(events.nth(1)).toContainText("Mars transfer burn");
  await expect(events.nth(2)).toContainText("Mars orbit insertion");
  for (const band of await page.getByTestId("risk-band").allTextContents()) {
    expect(band).toMatch(/^(~\d+%|Over \d+%)$/);
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Flyby Probe"]);
  await expect(events).toHaveCount(2);
  await expect(page.getByTestId("mission-events")).not.toContainText(
    "Mars orbit insertion",
  );
});

test("buys Reliability, sees the risk band and cost change, and launches", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  const insertion = page
    .getByTestId("mission-event")
    .filter({ hasText: "Mars orbit insertion" });
  const band = insertion.getByTestId("risk-band");
  const bandBefore = await band.textContent();
  const costBefore = await page.getByTestId("mission-cost").textContent();
  await expect(insertion.getByRole("combobox")).toHaveValue("none");

  await insertion.getByRole("combobox").selectOption("redundant");
  await expect(band).not.toHaveText(bandBefore ?? "");
  await expect(page.getByTestId("mission-cost")).not.toHaveText(
    costBefore ?? "",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  await playToNextTurn(page);

  // Reliability applied to that Mission only.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("mission-cost")).toHaveText(costBefore ?? "");
  await expect(insertion.getByRole("combobox")).toHaveValue("none");
  expect(problems).toEqual([]);
});

test("retires a Program and starts a new one from the Program summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto("/");

  // Beside Save and Load, with no section of its own.
  await expect(page.getByRole("heading", { name: "Retire" })).toHaveCount(0);
  const actions = page.locator(".program-actions");
  await expect(actions.getByRole("button")).toHaveText([
    "Save",
    "Load",
    "Retire Program",
  ]);

  const retire = page.getByRole("button", { name: "Retire Program" });
  const dialog = page.getByRole("dialog", { name: "Retire Program" });
  await retire.click();
  await expect(dialog).toContainText("This ends it for good");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Keep going" }).click();
  await expect(dialog).toHaveCount(0);

  await retire.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();

  await retire.click();
  await dialog.getByRole("button", { name: "Yes, retire the Program" }).click();

  const summary = page.getByTestId("program-summary");
  await expect(summary).toContainText("You retired this Program");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(summary.getByTestId("total-science")).toHaveText("0");

  await page.getByRole("button", { name: "Start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  expect(problems).toEqual([]);
});

test("lets a Turn pass without launching, and cancels the Program when Public Support falls too far", async ({
  page,
}) => {
  // A small window, because nothing here depends on the layout and software rendering at 4K is slow.
  await page.setViewportSize({ width: 1280, height: 720 });
  await overrideProgramData(page, cancelledAfterOneTurn);
  await page.goto("/");

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "No Mission this Turn",
  );
  await page.getByRole("button", { name: "10x" }).click();

  const turnSummary = page.getByTestId("turn-summary");
  await expect(turnSummary).toContainText("cancelled");
  await expect(turnSummary.getByTestId("summary-public-support")).toHaveText(
    "100 to 85",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  const programSummary = page.getByTestId("program-summary");
  await expect(programSummary).toContainText(
    "below the Cancellation Level of 90",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("shows why a plan the player can't afford is rejected", async ({
  page,
}) => {
  await overrideProgramData(page, { startingMoneyMillions: 500 });
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText("costs $1B");
  await expect(page.getByRole("alert")).toContainText("$500M");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeDisabled();
});

test("refuses to load invalid data files, with a clear error", async ({
  page,
}) => {
  await page.route("**/data/assets.json", (route) =>
    route.fulfill({
      json: [{ id: "broken", name: "Broken", kind: "orbiter" }],
    }),
  );
  await page.goto("/");

  const error = page.getByRole("alert");
  await expect(error).toContainText("assets.json");
  await expect(error).toContainText("costMillions");
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toHaveCount(0);
});
