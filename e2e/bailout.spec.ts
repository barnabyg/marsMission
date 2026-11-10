import { expect, test, type Page } from "@playwright/test";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { seedFailingAt } from "./seeds";
import { endTurnWithoutLaunching } from "./turnHelpers";

test.use({ viewport: missionViewport });

/** Launches the first orbiter on a seed that loses it at launch, and skips to the Turn summary. */
async function loseTheFirstOrbiter(page: Page): Promise<void> {
  await page.goto(`/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "Skip to Turn summary" }).click();
}

test("offers the Bailout for a lost Mission in the Turn summary, and repays it as the next Turn ends", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await loseTheFirstOrbiter(page);

  const card = page.getByTestId("summary-bailout");
  await expect(card).toContainText(
    "The Bailout refunds $1B for what was lost. It is repaid at $100M as each of the next 10 Turns ends",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await card.getByRole("button", { name: "Take the Bailout: +$1B" }).click();
  await expect(card.getByRole("status")).toHaveText(
    "Bailout taken: $1B added to Money, repaid at $100M as each of the next 10 Turns ends.",
  );
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  // $2.3B less the $1B Mission, with $200M of base funding, and the $1B Bailout.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("money")).toHaveText("$2.5B");
  await expect(page.getByTestId("bailout-panel")).toHaveCount(0);

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "Skip to Turn summary" }).click();
  await expect(
    page.getByTestId("summary-money-spent").getByRole("listitem"),
  ).toHaveText(["Bailout repayment$100M"]);
  await expect(page.getByTestId("summary-bailout")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("keeps the Bailout on offer in Planning Mode until the next Turn, also after a reload", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await loseTheFirstOrbiter(page);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  const panel = page.getByTestId("bailout-panel");
  await expect(panel).toContainText("The Bailout refunds $1B");
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("money")).toHaveText("$1.5B");
  await panel.getByRole("button", { name: "Take the Bailout: +$1B" }).click();
  await expect(page.getByTestId("money")).toHaveText("$2.5B");
  await expect(panel).toHaveCount(0);

  // Taking it saved the game at once.
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("money")).toHaveText("$2.5B");
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("3");
  expect(problems).toEqual([]);
});

test("lets an offered Bailout lapse once the next Turn is played", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await loseTheFirstOrbiter(page);
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByTestId("bailout-panel")).toBeVisible();
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(page.getByTestId("bailout-panel")).toHaveCount(0);
  expect(problems).toEqual([]);
});
