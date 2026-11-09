import { expect, test } from "@playwright/test";
import {
  cancelledAfterOneTurn,
  chooseAssets,
  eventEntries,
  launchFirstMission,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  pauseAtEventAfter,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

test.use({ viewport: missionViewport });

test("plays from a new Program through a launch to the next Turn", async ({
  page,
}) => {
  // Over 5 s: a whole journey into the next Turn, stopping at two points.
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("launch-window")).toHaveText("December 2028");
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1B at 250 Public Support",
  );

  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();

  await expect(
    page.getByTestId("mission-scene").locator("canvas"),
  ).toBeVisible();
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing");
  await expect(eventEntries(page).last()).toContainText("1 December 2028");
  await expect(eventEntries(page).last()).toContainText("carries the Mission");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Nothing needs dismissing, so time just carries on when a speed is chosen.
  // Fast to three months before it, so the hold lands on its day and no later event slips in.
  await pauseAtEventAfter(
    page,
    "Funding Threshold reached: 250 Public Support",
    "1 April 2029",
  );
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
  expect(
    await eventEntries(page)
      .getByTestId("event-picture")
      .evaluateAll((pictures) =>
        pictures.map((picture) => picture.getAttribute("data-picture")),
      ),
  ).toEqual([
    "fundingThreshold",
    "survey",
    "milestone",
    "orbitInsertion",
    "transferBurn",
    "launch",
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(page.getByTestId("journey-progress")).toHaveText(
    /Pathfinder Orbiter: arrived at Mars/,
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter: Survey",
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
  // The Funding Threshold paid back the orbiter, and base funding added $200M for Public Support of 100.
  await expect(page.getByTestId("money")).toHaveText("$2.5B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1.5B at 425 Public Support",
  );
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Pathfinder Orbiter"]);
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
    // Over 5 s: plays on to the next Turn.
    const problems = watchForProblems(page);
    const seed = seedFailingAt(missionEvent);
    await launchFirstMission(page, seed, `${missionEvent} failed`, "5x");
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
    // The Mission's $1B is lost, and base funding added $200M.
    await expect(page.getByTestId("money")).toHaveText("$1.5B");
    await expect(page.getByTestId("operating-assets")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}

test("restarts with a new Program after asking first", async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: /^Skip to / }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  // Beside Save and Load, with no section of its own.
  await expect(page.getByRole("heading", { name: "Restart" })).toHaveCount(0);
  const actions = page.locator(".program-actions");
  await expect(actions.getByRole("button")).toHaveText([
    "Save",
    "Load",
    "Restart Program",
    "?",
  ]);

  const restart = page.getByRole("button", { name: "Restart Program" });
  const dialog = page.getByRole("dialog", { name: "Restart Program" });
  await restart.click();
  await expect(dialog).toContainText("This one ends for good");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Keep going" }).click();
  await expect(dialog).toHaveCount(0);

  await restart.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await restart.click();
  await dialog
    .getByRole("button", { name: "Yes, start a new Program" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(page.getByTestId("program-summary")).toHaveCount(0);
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
