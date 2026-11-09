import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  endTurnAndContinue,
  endTurnWithoutLaunching,
  missionViewport,
  openSaveDialog,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

test.use({ viewport: missionViewport });

test("tells the story of a cancelled Program: its Turns, Missions, Science, Milestones with their Turn and its seed", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Cancelled at the end of the first Turn, however well it goes.
  await overrideProgramData(page, { cancellationLevel: 1000 });
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);

  const summary = page.getByTestId("program-summary");
  await expect(summary.getByTestId("program-ending")).toContainText(
    "The Program has been cancelled.",
  );
  await expect(summary.getByTestId("program-turns")).toContainText(
    "1 Turn played",
  );
  await expect(summary.getByTestId("program-missions")).toContainText(
    "1 launched",
  );
  await expect(summary.getByTestId("program-missions")).toContainText("0 lost");
  await expect(summary.getByTestId("program-science")).not.toBeEmpty();
  await expect(
    summary.getByTestId("program-peak-public-support"),
  ).toBeVisible();
  await expect(summary.getByTestId("program-money")).toBeVisible();
  const milestone = summary.getByTestId("summary-milestone");
  await expect(milestone).toHaveCount(1);
  await expect(milestone).toContainText("First orbiter at Mars");
  await expect(milestone).toContainText("Turn 1");
  await expect(summary.getByTestId("program-seed")).toContainText(
    String(successSeed),
  );
  // No Crew flew and no samples came home, so neither is shown.
  await expect(summary.getByTestId("program-crew")).toHaveCount(0);
  await expect(summary.getByTestId("program-samples")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("offers Load… beside Start a new Program, which loads a Save Slot into Planning Mode", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await overrideProgramData(page, { cancellationLevel: 1000 });
  await page.goto(`/?seed=${successSeed}`);
  await openSaveDialog(page);
  await page
    .getByTestId("save-slot-2")
    .getByRole("button", { name: "Save here" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await endTurnWithoutLaunching(page);

  const summary = page.getByTestId("program-summary");
  await expect(summary.getByRole("button")).toHaveText([
    "Start a new Program",
    "Load…",
  ]);
  await summary.getByRole("button", { name: "Load…" }).click();
  const dialog = page.getByRole("dialog", { name: "Load from a Save Slot" });
  await dialog
    .getByTestId("save-slot-2")
    .getByRole("button", { name: "Load" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  expect(problems).toEqual([]);
});
