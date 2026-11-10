import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Opens the Launch Vehicle and Trajectory step if it has folded to one line, which it does once an Asset or Crew is
 * ticked, so that a test can change the Launch Vehicle or Trajectory after ticking something, as a player presses
 * Change to. Ticking or unticking anything else folds it again.
 */
export async function openLaunchStep(page: Page): Promise<void> {
  const change = page.getByRole("button", {
    name: "Change the Launch Vehicle and Trajectory",
  });
  if ((await change.count()) > 0) await change.click();
}

/** The row of Operating at Mars for the Asset with this label, such as "Pathfinder Orbiter 2". */
export function operatingRow(page: Page, label: string): Locator {
  return page.getByTestId("operating-asset").filter({ hasText: label });
}

/**
 * Ticks exactly these Assets for the planned Mission. It unticks the others first, because an Asset can't be ticked
 * while one that is ticked leaves it no room.
 */
export async function chooseAssets(page: Page, names: string[]): Promise<void> {
  const boxes = page.locator(".asset-choice");
  await expect(boxes.first()).toBeVisible();
  for (const wanted of [false, true]) {
    for (const box of await boxes.all()) {
      const text = (await box.textContent()) ?? "";
      if (names.some((name) => text.includes(name)) === wanted) {
        await box.getByRole("checkbox").setChecked(wanted);
      }
    }
  }
}
