import { expect, test, type Page } from "@playwright/test";
import {
  cancelledAfterOneTurn,
  overrideProgramData,
  pauseAtEvent,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  const played = await readTurnOutcome(page);

  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await pauseAtEvent(page, "Launch");
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Launch failed" }),
  ).toBeVisible();
  await endTurn(page);

  await expect(page.getByTestId("summary-failure")).toContainText("Launch");
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
