import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { orbitInsertionRescuedSeed } from "./seeds";

const panel = (page: Page) => page.getByTestId("tutorial-panel");

async function startTutorial(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Turn on Tutorial mode" }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe("at a Decision Point", () => {
  test.use({ viewport: missionViewport });

  test("Tutorial mode suggests an answer with its reason, and shows none once turned off", async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await startTutorial(page, orbitInsertionRescuedSeed);
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    await page.getByRole("checkbox", { name: /Reserve fuel/ }).check();
    await page.getByRole("button", { name: "Launch Mission" }).click();
    await page.getByRole("button", { name: "10x" }).click();

    const decisionPoint = page.getByTestId("decision-point");
    await expect(decisionPoint).toBeVisible();
    await expect(page.getByTestId("decision-advice")).toContainText(
      "Tutorial mode suggests: Use Reserve fuel",
    );
    await expect(page.getByTestId("decision-choice-use")).toHaveClass(
      /suggested/,
    );
    expect(await termsWithoutTooltips(page)).toEqual([]);

    await page.getByRole("button", { name: "Turn off Tutorial mode" }).click();
    await page.getByRole("button", { name: "Yes, turn it off" }).click();
    await expect(decisionPoint).toBeVisible();
    await expect(page.getByTestId("decision-advice")).toHaveCount(0);
    await expect(page.locator(".suggested")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
