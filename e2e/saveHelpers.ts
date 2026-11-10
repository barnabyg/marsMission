import type { Locator, Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";

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

/** Program data that gets cancelled at the end of its first Turn, whatever the real data files say. */
export const cancelledAfterOneTurn = {
  startingPublicSupport: 100,
  publicSupportDrainPercent: 15,
  cancellationLevel: 90,
};

/** Replaces values in the Program data file, for what the real data can't reach quickly. */
export async function overrideProgramData(
  page: Page,
  overrides: Record<string, number>,
): Promise<void> {
  await page.route("**/data/program.json", async (route) => {
    const response = await route.fetch();
    const program = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ json: { ...program, ...overrides } });
  });
}

/**
 * Opens the game with this save as the automatic save, and continues the Program from it, as a returning player does.
 * The save goes in once, before the first page load, so a reload later finds whatever the game has saved since.
 */
export async function continueFromSave(
  page: Page,
  save: string,
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("e2e-save-put") !== null) return;
      sessionStorage.setItem("e2e-save-put", "yes");
      localStorage.setItem(key, value);
    },
    [storageKeyFor("automatic"), save] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
}

export async function openSaveDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

export async function openLoadDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Load", exact: true }).click();
}
