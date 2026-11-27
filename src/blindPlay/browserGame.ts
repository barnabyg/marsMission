/**
 * The real game in a browser, as the blind player sees it: the screen as a screen reader reads it (Playwright's
 * accessibility snapshot) and the controls and game terms on it as actions. While a dialog is open, only the dialog.
 */
import type { Page } from "@playwright/test";
import type { Game, GameAction, GameScreen } from "./game";
import { findPageControls, type PageControl } from "./pageControls";

/** How an action is done: the control it uses, and the option for a select. */
interface Target {
  id: string;
  value?: string;
}

const waitLabel = "Wait and watch what happens";

/** Every action the controls offer, each with a label unique on the screen. */
export function actionsFor(
  controls: readonly PageControl[],
  missionPlaying: boolean,
): { action: GameAction; target: Target | null }[] {
  const actions: { action: GameAction; target: Target | null }[] = [];
  const add = (
    label: string,
    kind: GameAction["kind"],
    target: Target | null,
  ) => {
    let unique = label;
    for (let n = 2; actions.some((a) => a.action.label === unique); n++) {
      unique = `${label} (${String(n)})`;
    }
    actions.push({ action: { label: unique, kind }, target });
  };
  for (const control of controls) {
    switch (control.type) {
      case "button":
        add(`Press "${control.label}"`, "click", { id: control.id });
        break;
      case "link":
        add(`Follow "${control.label}"`, "click", { id: control.id });
        break;
      case "checkbox":
        add(
          `${control.checked ? "Untick" : "Tick"} "${control.label}"`,
          control.checked ? "untick" : "tick",
          { id: control.id },
        );
        break;
      case "radio":
        if (!control.checked) {
          add(`Choose "${control.label}"`, "tick", { id: control.id });
        }
        break;
      case "select":
        for (const option of control.options) {
          add(`Set "${control.label}" to "${option.text}"`, "choose", {
            id: control.id,
            value: option.value,
          });
        }
        break;
      case "term":
        add(`Hover over "${control.label}" to read its tooltip`, "hover", {
          id: control.id,
        });
        break;
    }
  }
  if (missionPlaying) add(waitLabel, "wait", null);
  return actions;
}

/** The lines of `after` that `before` didn't have, in order, at most `limit` of them. */
export function newLines(before: string, after: string, limit = 20): string[] {
  const seen = new Set(before.split("\n").map((line) => line.trim()));
  const added = after
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !seen.has(line));
  return added.length > limit
    ? [
        ...added.slice(0, limit),
        `… and ${String(added.length - limit)} more lines`,
      ]
    : added;
}

/**
 * Takes Tutorial mode's offer off the page, for a run that tests the game's own words: a player told of it, with no
 * way to take it up, only wonders why.
 */
export async function hideTutorialOffer(page: Page): Promise<void> {
  await page.addStyleTag({
    content: ".tutorial-offer { display: none !important; }",
  });
}

export interface BrowserGameOptions {
  /** The longest a Wait lets Mission Mode play before reading the screen again, in ms. */
  waitMs?: number;
  /** How long the page is given to settle after an action, in ms. */
  settleMs?: number;
}

export function createBrowserGame(
  page: Page,
  options: BrowserGameOptions = {},
): Game {
  const waitMs = options.waitMs ?? 30_000;
  const settleMs = options.settleMs ?? 400;
  let targets = new Map<string, Target | null>();
  let last: GameScreen | null = null;

  const snapshot = async (dialog: string | null) =>
    (dialog === null
      ? page.locator("body")
      : page.locator("dialog[open]")
    ).ariaSnapshot();

  const read = async (): Promise<GameScreen> => {
    // Every screen has a heading once it has loaded.
    await page
      .locator("h1")
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    const found = await page.evaluate(findPageControls);
    const text = await snapshot(found.dialog);
    const missionPlaying =
      found.dialog === null &&
      found.heading === "Mission Mode" &&
      (await page.getByRole("button", { name: "Pause" }).count()) > 0;
    const offered = actionsFor(found.controls, missionPlaying);
    targets = new Map(offered.map((o) => [o.action.label, o.target]));
    const turnText = await page
      .getByTestId("turn-number")
      .first()
      .textContent({ timeout: 500 })
      .catch(() => null);
    const ending = page.getByTestId("program-ending").locator("h2");
    const ended =
      (await ending.count()) > 0 ? await ending.first().textContent() : null;
    last = {
      name: found.dialog ?? found.heading,
      turn:
        turnText && /\d+/.test(turnText)
          ? Number(/\d+/.exec(turnText)?.[0])
          : null,
      text,
      actions: offered.map((o) => o.action),
      ended: ended?.trim() ?? null,
    };
    return last;
  };

  const settled = async () => {
    await page.waitForTimeout(settleMs);
  };

  /** Lets Mission Mode play until the events, the screen or a dialog change, or waitMs passes. */
  const watch = async () => {
    const state = () =>
      page.evaluate(() =>
        [
          document.querySelector("h1")?.textContent ?? "",
          document.querySelector("dialog[open]") ? "dialog" : "",
          document.querySelector("[data-testid=events-column] li")
            ?.textContent ?? "",
          document.querySelector("[aria-label='Decision Point']")
            ? "decision"
            : "",
        ].join("|"),
      );
    const start = await state();
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      if ((await state()) !== start) break;
    }
  };

  const act = async (action: GameAction): Promise<string> => {
    const target = targets.get(action.label);
    if (target === undefined || last === null) {
      return `"${action.label}" is not on the screen.`;
    }
    const before = last;
    const element =
      target === null ? null : page.locator(`[data-blind-id="${target.id}"]`);
    try {
      if (action.kind === "hover" && element) {
        await element.hover({ timeout: 5_000 });
        const tooltip = page.getByRole("tooltip");
        await tooltip.waitFor({ timeout: 2_000 }).catch(() => undefined);
        // Each term's name is a line of its own above what it means.
        const text = (await tooltip.allInnerTexts())
          .join("\n")
          .trim()
          .replace(/\s*\n\s*/g, ": ");
        await page.mouse.move(0, 0);
        return text ? `The tooltip says: ${text}` : "No tooltip appeared.";
      }
      if (action.kind === "wait") await watch();
      else if (action.kind === "choose" && element && target?.value) {
        await element.selectOption(target.value, { timeout: 5_000 });
      } else if (
        (action.kind === "tick" || action.kind === "untick") &&
        element
      ) {
        await element.setChecked(action.kind === "tick", { timeout: 5_000 });
      } else if (element) await element.click({ timeout: 5_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `The game didn't respond to it: ${message.split("\n")[0] ?? ""}`;
    }
    await settled();
    const after = await read();
    const added = newLines(before.text, after.text);
    const parts: string[] = [];
    if (after.name !== before.name)
      parts.push(`The screen is now "${after.name}".`);
    if (added.length > 0) parts.push(`New on screen:\n${added.join("\n")}`);
    return parts.length > 0 ? parts.join("\n") : "Nothing on screen changed.";
  };

  return { read, act };
}
