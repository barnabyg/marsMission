import { expect, type Locator, type Page } from "@playwright/test";
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

/** Returns any game term on screen that has no tooltip. Button labels and a select's options are plain text, so they don't count. */
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
          "[data-term], [role=tooltip], button, option, script, style",
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

export async function openSaveDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

export async function openLoadDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Load", exact: true }).click();
}

/** Mission Mode's events column entries, newest first. */
export function eventEntries(page: Page): Locator {
  return page.getByTestId("event-entry");
}

/** Waits for a Mission Event, Milestone or Funding Threshold to happen, then holds the Turn there to look at it. */
export async function pauseAtEvent(page: Page, title: string): Promise<void> {
  await expect(
    eventEntries(page).getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
}

/**
 * Holds the Turn from inside the page the moment an event with this title appears, or as soon as Mission Mode opens if
 * there's no title. Call it before the click that starts things moving. A Turn starts at the speed last chosen, and at
 * 10x pauseAtEvent's click from out here can land too late.
 */
export async function holdTurnWhenShown(
  page: Page,
  title?: string,
): Promise<void> {
  await page.evaluate((wanted) => {
    new MutationObserver((_, observer) => {
      const pause = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Pause",
      );
      const shown =
        wanted === null ||
        [...document.querySelectorAll("[data-testid=event-entry] h3")].some(
          (heading) => heading.textContent === wanted,
        );
      if (pause && shown) {
        observer.disconnect();
        pause.click();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, title ?? null);
}

/**
 * Holds the Turn from inside the page once a landing or crash has played for this long, or just
 * after it ends if no time is given. It resolves then, so start it before anything that sets the Turn going.
 */
export function holdSequence(page: Page, atMs?: number): Promise<void> {
  return page.evaluate(
    (wanted) =>
      new Promise<void>((resolve) => {
        let seen = false;
        // The scene loads a moment after Mission Mode opens, and it goes when the Turn ends.
        let loaded = false;
        requestAnimationFrame(function check() {
          const view = document.querySelector<HTMLElement>(
            "[data-testid=solar-system-view]",
          );
          const playedMs = view?.dataset.sequenceMs;
          seen ||= playedMs !== undefined;
          loaded ||= view !== null;
          const reached =
            wanted === null
              ? seen && playedMs === undefined
              : Number(playedMs ?? -1) >= wanted;
          if ((loaded && !view) || reached) {
            [...document.querySelectorAll("button")]
              .find((button) => button.textContent === "Pause")
              ?.click();
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        });
      }),
    atMs ?? null,
  );
}

/** Ticks exactly these Assets for the planned Mission. */
export async function chooseAssets(page: Page, names: string[]): Promise<void> {
  const boxes = page.locator(".asset-choice");
  await expect(boxes.first()).toBeVisible();
  for (const box of await boxes.all()) {
    const text = (await box.textContent()) ?? "";
    await box
      .getByRole("checkbox")
      .setChecked(names.some((name) => text.includes(name)));
  }
}

/** Plays out the rest of a Turn in Mission Mode at top speed, and continues past its Turn summary. */
export async function playToNextTurn(page: Page): Promise<void> {
  const fastest = page.getByRole("button", { name: "10x" });
  const summary = page.getByTestId("turn-summary");
  await expect(fastest.or(summary)).toBeVisible();
  // The Turn may end before the click lands, which is fine.
  await fastest.click({ timeout: 2000 }).catch(() => undefined);
  await summary.getByRole("button", { name: "Continue" }).click();
}

export function viewButton(
  page: Page,
  name: "Solar system" | "Mars orbit" | "Surface",
) {
  return page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });
}

export function surfaceAssets(page: Page) {
  return page.getByTestId("surface-asset");
}

export function orbiterLabels(page: Page) {
  return page.getByTestId("mars-orbit-asset");
}

export async function launchFirstMission(
  page: Page,
  seed: number,
): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
}
