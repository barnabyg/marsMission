import type { Page } from "@playwright/test";
import { termPattern } from "../src/ui/tooltips";

// What browser tests of every subject share: the windows they use, the problems they fail on, the tooltip checks and
// the sounds heard. Planning Mode's controls are in planningHelpers.ts, saves and data overrides in saveHelpers.ts, and
// Mission Mode's playback in playbackHelpers.ts.

/**
 * @react-three/fiber 9.8.2 still creates a THREE.Clock, which three 0.187 warns about on load. It's
 * harmless and not ours to fix. Remove this exception once a @react-three/fiber upgrade stops it.
 */
const knownThirdPartyWarning =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

/**
 * The window for tests of how Mission Mode plays, rather than how it's laid out: 1920×1080, a display the game supports.
 * Software rendering at 4K takes a worker most of a CPU core, and a starved frame rate holds playback back, so these
 * tests take about half as long at this size. Use it with `test.use({ viewport: missionViewport })` at the top of a file.
 */
export const missionViewport = { width: 1920, height: 1080 };

/** The 4K window the other tests use, for a test in a `missionViewport` file that checks where things sit on screen. */
export const fourKViewport = { width: 3840, height: 2160 };

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

/**
 * Returns any game term on screen that has no tooltip. Button labels and a select's options are plain text, so they
 * don't count, and nor does the game's name (marked data-game-name), whose "Mission" isn't the game term, or text only
 * for a screen reader (visually-hidden), which can't be hovered.
 */
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
          "[data-term], [data-game-name], [role=tooltip], .visually-hidden, button, option, script, style",
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

/** Records each sound as it starts, with what the events column shows at that moment. */
export async function listenForSounds(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[][] = [];
    (window as unknown as { soundLog: string[][] }).soundLog = log;
    const play: () => Promise<void> = Reflect.get(
      HTMLMediaElement.prototype,
      "play",
    );
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      log.push([
        this.src.split("/").at(-1) ?? "",
        document.querySelector("[data-testid=events-column]")?.textContent ??
          "",
      ]);
      return play.call(this);
    };
  });
}

export function soundsHeard(page: Page): Promise<string[][]> {
  return page.evaluate(
    () => (window as unknown as { soundLog: string[][] }).soundLog,
  );
}
