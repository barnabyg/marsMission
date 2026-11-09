import type { Page } from "@playwright/test";

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
