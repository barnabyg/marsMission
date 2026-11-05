import type { Locator, Page } from "@playwright/test";

/** A 1920×1080 desktop, and a 4K monitor at 150% Windows display scaling and at 100% (ADR 0001). */
export const screenSizes = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

/** The smallest supported screen, on which a busy Program has more at Mars than its panel can show at once. */
const smallestHeight = 1080;

/**
 * What has more to show than fits on screen, if anything: the page, or any panel in Planning Mode, each named with how
 * far it overflows, so that a failure says what to fix. The New Mission steps may scroll up and down by themselves,
 * under the New Mission's buttons, which stay in view, but never sideways. On a 1920×1080 screen, the panels beside
 * them may scroll up and down by themselves too, but never sideways.
 */
export function whatScrolls(page: Page): Promise<string[]> {
  const sidePanelsMayScroll =
    (page.viewportSize()?.height ?? Infinity) <= smallestHeight;
  return page.evaluate((sideMayScroll) => {
    const found: string[] = [];
    const describe = (element: Element) =>
      element.querySelector("h2")?.textContent ?? element.className;
    const { scrollHeight, scrollWidth } = document.documentElement;
    if (scrollHeight > innerHeight) {
      found.push(`page down by ${String(scrollHeight - innerHeight)}px`);
    }
    if (scrollWidth > innerWidth) {
      found.push(`page sideways by ${String(scrollWidth - innerWidth)}px`);
    }
    for (const panel of document.querySelectorAll(".planning-columns .panel")) {
      const down = panel.scrollHeight - panel.clientHeight;
      if (down > 0 && !(sideMayScroll && panel.closest(".planning-side"))) {
        found.push(`${describe(panel)} down by ${String(down)}px`);
      }
      const sideways = panel.scrollWidth - panel.clientWidth;
      if (sideways > 0) {
        found.push(`${describe(panel)} sideways by ${String(sideways)}px`);
      }
    }
    for (const steps of document.querySelectorAll(".mission-steps")) {
      const sideways = steps.scrollWidth - steps.clientWidth;
      if (sideways > 0) {
        found.push(`New Mission steps sideways by ${String(sideways)}px`);
      }
    }
    return found;
  }, sidePanelsMayScroll);
}

/** Whether all these elements sit side by side, on one line. */
export async function onOneLine(elements: Locator[]): Promise<boolean> {
  const boxes = await Promise.all(elements.map((each) => each.boundingBox()));
  const middles = boxes.map((box) => (box ? box.y + box.height / 2 : -1));
  const lowest = Math.min(...middles);
  return lowest >= 0 && Math.max(...middles) - lowest < 10;
}

/**
 * The text of each element that is cut off or squeezed into a column too narrow to read, such as one word a line.
 * Each must show all its text, and be at least 15 rem wide or as wide as its text on one line.
 */
export function unreadableText(elements: Locator): Promise<string[]> {
  return elements.evaluateAll((all) =>
    all
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const rem = parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        );
        const range = document.createRange();
        range.selectNodeContents(element);
        const oneLine = Math.max(
          ...[...range.getClientRects()].map(({ width }) => width),
          0,
        );
        const cut =
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1;
        return (
          cut ||
          (box.width < 15 * rem &&
            box.height > 2.5 * rem &&
            oneLine < box.width + 1)
        );
      })
      .map((element) => element.textContent),
  );
}
