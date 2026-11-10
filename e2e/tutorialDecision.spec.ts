import { expect, test, type Page } from "@playwright/test";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { holdOffSeed, orbitInsertionRescuedSeed } from "./seeds";

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
    await expect(page.getByTestId("decision-advice")).toHaveClass(
      /\btutorial-voice\b/,
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

  test("only the suggested choice is primary, and the panel leaves the Landing Site clear", async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await startTutorial(page, holdOffSeed);
    await chooseAssets(page, ["Prospector Lander"]);
    await page.getByRole("button", { name: "Launch Mission" }).click();
    await page.getByRole("button", { name: "10x" }).click();

    const decisionPoint = page.getByTestId("decision-point");
    await expect(decisionPoint).toBeVisible();
    await expect(page.getByTestId("current-view")).toHaveText("Surface");
    // Tutorial mode suggests the second choice, so that one alone is primary.
    await expect(page.getByTestId("decision-advice")).toContainText(
      "Tutorial mode suggests: Hold off",
    );
    const primary = decisionPoint.locator("button.primary");
    await expect(primary).toHaveText("Hold off");
    await expect(primary).toHaveCount(1);

    // A lander at the Landing Site stands in the middle of the view, its shadow reaching two thirds of the way down.
    const scene = await page.getByTestId("mission-scene").boundingBox();
    const panel = await decisionPoint.boundingBox();
    expect(scene && panel).not.toBeNull();
    if (scene && panel) {
      expect(panel.y).toBeGreaterThan(scene.y + (scene.height * 2) / 3);
    }

    await page.getByRole("button", { name: "Turn off Tutorial mode" }).click();
    await page.getByRole("button", { name: "Yes, turn it off" }).click();
    await expect(decisionPoint).toBeVisible();
    await expect(primary).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
