import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  cancelledAfterOneTurn,
  chooseAssets,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";
import {
  confirmEndWithoutLaunching,
  endWithoutLaunchingDialog,
} from "./turnHelpers";

test.use({ viewport: missionViewport });

function endTurn(page: Page): Promise<void> {
  return page.getByRole("button", { name: "End Turn", exact: true }).click();
}

/** What the Turn summary and the next Planning Mode report, to compare two ways of reaching them. */
async function readTurnOutcome(page: Page) {
  const summary = await page.getByTestId("turn-summary").innerText();
  await page.getByRole("button", { name: "Continue" }).click();
  const planning = await Promise.all(
    [
      "turn-number",
      "launch-window",
      "money",
      "science",
      "public-support",
      "milestones",
      "operating-assets",
    ].map((id) => page.getByTestId(id).innerText()),
  );
  return { summary, planning };
}

test("ending a Turn partway gives the same outcome as playing it to the end", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  const played = await readTurnOutcome(page);

  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await pauseAtEvent(page, "Launch", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await expect(
    page.getByRole("button", { name: "End Turn", exact: true }),
  ).toHaveAttribute("title", /The rest of the Turn still happens/);
  await endTurn(page);

  await expect(page.getByTestId("turn-summary")).toBeVisible();
  const skipped = await readTurnOutcome(page);
  expect(skipped).toEqual(played);
  expect(skipped.planning[0]).toBe("2");
  expect(problems).toEqual([]);
});

test("ending a Turn after a Mission fails still reports the failure", async ({
  page,
}) => {
  await page.goto(`/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Launch failed" }),
  ).toBeVisible();
  await endTurn(page);

  await expect(page.getByTestId("summary-failure")).toContainText("Launch");
});

test("asks before ending the Turn without launching a planned Mission, and keeps the plan if asked to", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Trailblazer Rover"]);
  const withoutLaunching = page.getByRole("button", {
    name: "End Turn without launching",
  });
  const launch = page.getByRole("button", { name: "Launch Mission" });
  // At the budget bar's far end, as plain text, well clear of Launch Mission, so the primary action stands alone.
  const right = async (locator: Locator) =>
    locator.evaluate((element) => element.getBoundingClientRect().right);
  const left = async (locator: Locator) =>
    locator.evaluate((element) => element.getBoundingClientRect().left);
  expect(
    (await left(withoutLaunching)) - (await right(launch)),
  ).toBeGreaterThan(40);
  expect(await right(withoutLaunching)).toBeCloseTo(
    await right(page.getByTestId("budget-bar")),
    0,
  );
  await expect(withoutLaunching).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  await withoutLaunching.click();
  const dialog = endWithoutLaunchingDialog(page);
  await expect(dialog).toContainText(
    "End the Turn without launching? The Mission you planned is dropped.",
  );
  await dialog.getByRole("button", { name: "Keep planning" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .locator(".asset-choice", { hasText: "Trailblazer Rover" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await expect(launch).toBeEnabled();

  await withoutLaunching.click();
  await confirmEndWithoutLaunching(page);
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "No Mission this Turn",
  );
  expect(problems).toEqual([]);
});

test("ends the Turn without launching at once when nothing is ticked", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "No Mission this Turn",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("ending a Turn that cancels the Program means it can't be reopened", async ({
  page,
}) => {
  await overrideProgramData(page, cancelledAfterOneTurn);
  await page.goto("/");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await endTurn(page);

  await expect(page.getByTestId("turn-summary")).toContainText("cancelled");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("program-summary")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});
