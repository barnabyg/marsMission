import type { Locator, Page } from "@playwright/test";
import { openLoadDialog, openSaveDialog } from "./helpers";

/** The Save or Load dialog's one button that saves to or loads the slot picked, whose name says what it will do. */
export function confirmSlotButton(page: Page): Locator {
  return page
    .getByRole("dialog")
    .getByRole("button", { name: /^(Save to|Overwrite|Load) / });
}

/** Picks a slot in the open Save or Load dialog, then saves to or loads it. */
export async function chooseSlotAndConfirm(
  page: Page,
  slot: 1 | 2 | 3,
): Promise<void> {
  await page.getByTestId(`save-slot-${slot}`).getByRole("radio").check();
  await confirmSlotButton(page).click();
}

/** Saves the Program to a Save Slot from Planning Mode. */
export async function saveToSlot(page: Page, slot: 1 | 2 | 3): Promise<void> {
  await openSaveDialog(page);
  await chooseSlotAndConfirm(page, slot);
}

/** Loads a Save Slot from Planning Mode, replacing the Program in play. */
export async function loadFromSlot(page: Page, slot: 1 | 2 | 3): Promise<void> {
  await openLoadDialog(page);
  await chooseSlotAndConfirm(page, slot);
}
