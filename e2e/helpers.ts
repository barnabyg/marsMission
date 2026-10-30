import type { Page } from "@playwright/test";
import { termPattern } from "../src/ui/tooltips";

/**
 * @react-three/fiber 9.8.2 still creates a THREE.Clock, which three 0.187 warns about on load. It's
 * harmless and not ours to fix. Remove this exception once a @react-three/fiber upgrade stops it.
 */
const knownThirdPartyWarning =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

/** Fails the test on anything the browser reports as a problem. */
export function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.text() === knownThirdPartyWarning) return;
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(message.text());
    }
  });
  return problems;
}

/** Returns any game term on screen that has no tooltip. Button labels are plain text, so they don't count. */
export function termsWithoutTooltips(page: Page): Promise<string[]> {
  return page.evaluate((pattern) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const missing: string[] = [];
    while (walker.nextNode()) {
      const { parentElement, textContent } = walker.currentNode;
      if (
        parentElement?.closest(
          "[data-term], [role=tooltip], button, script, style",
        )
      ) {
        continue;
      }
      missing.push(...(textContent?.match(new RegExp(pattern, "g")) ?? []));
    }
    return missing;
  }, termPattern.source);
}

/** Returns any game term highlighted inside a button, where it shouldn't be. */
export function termsInButtons(page: Page): Promise<string[]> {
  return page.locator("button [data-term]").allTextContents();
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

/** Plays out a Turn in Mission Mode, whatever happens in it, and continues past its Turn summary. */
export async function playToNextTurn(page: Page): Promise<void> {
  const screen = page.getByTestId("text-screen");
  const summary = page.getByTestId("turn-summary");
  while (!(await summary.isVisible())) {
    if (await screen.isVisible()) {
      await screen.getByRole("button", { name: "Continue" }).click();
    }
  }
  await summary.getByRole("button", { name: "Continue" }).click();
}
