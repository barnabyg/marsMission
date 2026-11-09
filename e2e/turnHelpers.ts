import { expect, type Page } from "@playwright/test";

/**
 * Skips the rest of a Turn in Mission Mode with End Turn, which gives the same outcome as playing it out, and continues
 * past its Turn summary. Unlike playing it out at 10x, it leaves the next Turn at the speed this one was at.
 */
export async function endTurnAndContinue(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
}

/** The dialog that asks before ending the Turn without launching a Mission that is planned. */
export function endWithoutLaunchingDialog(page: Page) {
  return page.getByRole("dialog", { name: "End Turn without launching" });
}

/** Answers End Turn when the game asks before ending the Turn without launching the Mission planned. */
export function confirmEndWithoutLaunching(page: Page): Promise<void> {
  return endWithoutLaunchingDialog(page)
    .getByRole("button", { name: "End Turn", exact: true })
    .click();
}

/**
 * Ends a Turn with nothing launched, and continues past its Turn summary. If a Mission is planned, the game asks first,
 * and this answers End Turn, dropping it.
 */
export async function endTurnWithoutLaunching(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  const dialog = endWithoutLaunchingDialog(page);
  await expect(dialog.or(page.getByTestId("mission-info"))).toBeVisible();
  if (await dialog.isVisible()) await confirmEndWithoutLaunching(page);
  await endTurnAndContinue(page);
}
