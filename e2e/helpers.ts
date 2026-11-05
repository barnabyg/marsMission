import { expect, type Locator, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
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

/** Mission Mode's events column entries, newest first. */
export function eventEntries(page: Page): Locator {
  return page.getByTestId("event-entry");
}

/**
 * Does `start`, which sets the Turn going and can then act or check things as it plays, and holds the Turn on the day a
 * Mission Event, Milestone or Funding Threshold with this title happens, to look at it. The hold is set from inside the
 * page before `start`, as a click on Pause from out here can land days later, or after the Turn has ended.
 */
export async function pauseAtEvent(
  page: Page,
  title: string,
  start: () => Promise<unknown>,
  speed?: Speed,
): Promise<void> {
  await holdTurnWhenShown(page, title, speed);
  await start();
  await expect(
    eventEntries(page).getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
}

type Speed = "1x" | "5x" | "10x";

/**
 * Holds the Turn from inside the page the moment an event with this title appears, or as soon as Mission Mode opens if
 * there's no title. Call it before the click that starts things moving, as a click on Pause from out here can land too
 * late. With a speed, it also plays at that speed from the first moment it can, which is as Mission Mode opens, or at
 * once if it's open already: a quick way to an event late in the Turn, when how it plays on the way isn't the point.
 * The hold lands a frame or two after the event, so at speed it can be weeks or months late. Where that matters, slow
 * down before the event with pauseAtEventAfter.
 */
export async function holdTurnWhenShown(
  page: Page,
  title?: string,
  speed?: Speed,
): Promise<void> {
  await page.evaluate(
    ([wanted, fast]) => {
      let sped = fast === null;
      const check = (observer: MutationObserver) => {
        const buttons = [...document.querySelectorAll("button")];
        const pause = buttons.find((button) => button.textContent === "Pause");
        const shown =
          wanted === null ||
          [...document.querySelectorAll("[data-testid=event-entry] h3")].some(
            (heading) => heading.textContent === wanted,
          );
        if (pause && shown) {
          observer.disconnect();
          pause.click();
          return;
        }
        const speedButton = buttons.find(
          (button) => button.textContent === fast,
        );
        if (!sped && speedButton) {
          sped = true;
          speedButton.click();
        }
      };
      const observer = new MutationObserver((_, self) => {
        check(self);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (!sped) check(observer);
    },
    [title ?? null, speed ?? null] as const,
  );
}

/**
 * Plays at 5x until Mission Mode's date reaches `slowFrom`, as in "10 December 2032", and then at 1x, all from inside
 * the page, so as to get quickly to an event but hold on it close to its day. Hold the Turn at the event with
 * holdTurnWhenShown first. Resolves once it has slowed, or once the hold has struck first.
 */
export function playFastUntil(page: Page, slowFrom: string): Promise<void> {
  return page.evaluate(
    (slowAt) =>
      new Promise<void>((resolve) => {
        const click = (name: string) => {
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent === name)
            ?.click();
        };
        const text = (testId: string) =>
          document.querySelector(`[data-testid=${testId}]`)?.textContent ?? "";
        click("5x");
        requestAnimationFrame(function check() {
          if (text("current-speed") !== "5x") {
            resolve();
          } else if (Date.parse(text("mission-date")) >= Date.parse(slowAt)) {
            click("1x");
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        });
      }),
    slowFrom,
  );
}

/**
 * Holds the Turn close to the day of the event with this title, getting there at 5x until `slowFrom` and at 1x after
 * it. A frame or two at 5x can be a couple of months on a busy machine, so `slowFrom` wants to be three months or so
 * before the event. Mission Mode must be open already.
 */
export async function pauseAtEventAfter(
  page: Page,
  title: string,
  slowFrom: string,
): Promise<void> {
  await pauseAtEvent(page, title, () => playFastUntil(page, slowFrom));
}

/** Launches the planned Mission, holding the Turn as Mission Mode opens. */
export async function launchHeld(page: Page): Promise<void> {
  await holdTurnWhenShown(page);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
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
          const scene = document.querySelector<HTMLElement>(
            "[data-testid=mission-scene]",
          );
          const playedMs = scene?.dataset.sequenceMs;
          seen ||= playedMs !== undefined;
          loaded ||= scene !== null;
          const reached =
            wanted === null
              ? seen && playedMs === undefined
              : Number(playedMs ?? -1) >= wanted;
          if ((loaded && !scene) || reached) {
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

/** Plays out the rest of a Turn in Mission Mode at top speed, and continues past its Turn summary. */
export async function playToNextTurn(page: Page): Promise<void> {
  const fastest = page.getByRole("button", { name: "10x" });
  const summary = page.getByTestId("turn-summary");
  await expect(fastest.or(summary)).toBeVisible();
  // The Turn may end before the click lands, which is fine.
  await fastest.click({ timeout: 2000 }).catch(() => undefined);
  await summary.getByRole("button", { name: "Continue" }).click();
}

/**
 * Skips the rest of a Turn in Mission Mode with End Turn, which gives the same outcome as playing it out, and continues
 * past its Turn summary. Unlike playing it out at top speed, it leaves the next Turn at the speed this one was at.
 */
export async function endTurnAndContinue(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();
}

/** Ends a Turn with nothing launched, and continues past its Turn summary. */
export async function endTurnWithoutLaunching(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await endTurnAndContinue(page);
}

type ViewName = "Solar system" | "Mars orbit" | "Surface" | "Spacecraft";

export function viewButton(page: Page, name: ViewName) {
  return page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });
}

/**
 * Plays at this speed, switches to this view and pauses, all from inside the page in one go, and returns the view and
 * speed shown while it played. At speed, a busy machine can reach the Turn's end between two clicks from out here.
 * Waiting on microtasks lets React show each click without a frame passing, so no game time passes either.
 */
export function switchViewWhilePlaying(
  page: Page,
  speed: Speed,
  view: ViewName,
): Promise<{ view: string | null; speed: string | null }> {
  return page.evaluate(
    async ([speed, view]) => {
      const click = async (name: string) => {
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === name)
          ?.click();
        await Promise.resolve();
        await Promise.resolve();
      };
      const text = (testId: string) =>
        document.querySelector(`[data-testid=${testId}]`)?.textContent ?? null;
      await click(speed);
      await click(view);
      const seen = { view: text("current-view"), speed: text("current-speed") };
      await click("Pause");
      return seen;
    },
    [speed, view] as const,
  );
}

export function surfaceAssets(page: Page) {
  return page.getByTestId("surface-asset");
}

export function orbiterLabels(page: Page) {
  return page.getByTestId("mars-orbit-asset");
}

/**
 * Launches the first Mission with Pathfinder Orbiter, holding the Turn at the event with this title if there is one,
 * and playing there at this speed if one is given.
 */
export async function launchFirstMission(
  page: Page,
  seed: number,
  pauseAt?: string,
  speed?: Speed,
): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const launch = () =>
    page.getByRole("button", { name: "Launch Mission" }).click();
  await (pauseAt === undefined
    ? launch()
    : pauseAtEvent(page, pauseAt, launch, speed));
  await expect(
    page.getByTestId("mission-scene").locator("canvas"),
  ).toBeVisible();
}
