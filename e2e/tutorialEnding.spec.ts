import { expect, test, type Page } from "@playwright/test";
import {
  continueFromSave,
  endTurnWithoutLaunching,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { cantRecoverSave, goalReachedSave } from "./tutorialSeeds";

test.describe("the tutorial's end", () => {
  /** Reloads and continues, to check that it stays ended in the automatic save. */
  async function continueAgain(page: Page): Promise<void> {
    await page.reload();
    await page.getByRole("button", { name: "Continue this Program" }).click();
    await expect(page.getByTestId("turn-number")).toBeVisible();
  }

  test("at its goal, says so with what was learnt, then shows no more advice, also after a reload", async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await continueFromSave(page, goalReachedSave);
    const dialog = page.getByRole("dialog", { name: "Tutorial complete" });
    await expect(dialog).toContainText("Crew have landed at a Base");
    expect(
      await dialog.getByTestId("tutorial-ending").locator("li").count(),
    ).toBeGreaterThan(0);
    expect(await termsWithoutTooltips(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Keep playing" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("tutorial-panel")).toHaveCount(0);

    await continueAgain(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("tutorial-panel")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("when it can't recover, says what went wrong, and the Program carries on without advice, also after a reload", async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await continueFromSave(page, cantRecoverSave);
    const dialog = page.getByRole("dialog", { name: "Tutorial ended" });
    await expect(dialog).toContainText("A Base is now out of reach");
    await dialog.getByRole("button", { name: "Keep playing" }).click();
    await expect(page.getByTestId("tutorial-panel")).toHaveCount(0);
    await expect(page.getByTestId("turn-number")).toHaveText("1");

    await endTurnWithoutLaunching(page);
    await expect(page.getByTestId("turn-number")).toHaveText("2");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("tutorial-panel")).toHaveCount(0);
    await continueAgain(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("tutorial-panel")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
