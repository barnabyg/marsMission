import { expect, test } from "@playwright/test";
import { tooltips } from "../src/ui/tooltips";
import { termsInButtons, termsWithoutTooltips } from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { endTurnAndContinue } from "./turnHelpers";
import { successSeed } from "./seeds";

// Tooltips themselves: how they open, where they sit, and which text has one. The terms of each area are in
// tooltipTerms.spec.ts.

test("explains a game term on hover, as the term's description, and in the glossary from the keyboard", async ({
  page,
}) => {
  await page.goto("/");

  const term = page.locator("dt [data-term='Public Support']");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveCount(0);

  await term.hover();
  await expect(tooltip).toContainText(tooltips["Public Support"]);
  // A screen reader hears the tooltip as the term's description while it shows.
  await expect(term).toHaveAccessibleDescription(
    new RegExp(tooltips["Public Support"].slice(0, 40)),
  );

  await page.getByRole("heading", { name: "New Mission", exact: true }).hover();
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await expect(term).not.toHaveAttribute("aria-describedby");

  // Terms aren't tab stops: the glossary key lists every term on screen instead.
  await page.keyboard.press("?");
  const glossary = page.getByRole("dialog", { name: "Glossary" });
  await expect(glossary).toBeVisible();
  const entry = glossary
    .getByTestId("glossary")
    .locator("div")
    .filter({ has: page.locator("dt", { hasText: /^Public Support$/ }) });
  await expect(entry.locator("dd")).toHaveText(tooltips["Public Support"]);
  await expect(glossary.locator("dt", { hasText: /^Mission$/ })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(glossary).toHaveCount(0);

  // The button beside Save says which key opens it.
  const button = page.getByRole("button", { name: "Glossary" });
  await expect(button).toHaveAttribute("aria-keyshortcuts", "?");
  await button.click();
  await expect(glossary).toBeVisible();
  // Typing a "?" while the glossary is open doesn't open a second one.
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("tabbing from the top of Planning Mode reaches Launch Mission in under 30 stops on a new Program", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  let stops = 0;
  while (stops < 30) {
    await page.keyboard.press("Tab");
    stops++;
    const name = await page.evaluate(() => document.activeElement?.textContent);
    if (name === "Launch Mission") break;
  }
  expect(stops).toBeLessThan(30);
});

test("game terms and their tags aren't tab stops", async ({ page }) => {
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const focusableTerms = await page
    .locator("[data-term], [data-terms]")
    .evaluateAll(
      (elements) =>
        elements.filter(
          (element) =>
            element instanceof HTMLElement &&
            element.tabIndex >= 0 &&
            !element.matches("select, input, button"),
        ).length,
    );
  expect(focusableTerms).toBe(0);
});

test("the tooltip check ignores buttons but still catches a term anywhere else", async ({
  page,
}) => {
  await page.goto("/");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      "<button>Save this Program</button>",
    );
  });
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", "<p>Save this Program</p>");
  });
  expect(await termsWithoutTooltips(page)).toEqual(["Program"]);
});

test("no button highlights a game term, while the text around it keeps its tooltips", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  expect(await termsInButtons(page)).toEqual([]);

  const launch = page.getByRole("button", { name: "Launch Mission" });
  await launch.hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("h2 [data-term='Mission']").hover();
  await expect(page.getByRole("tooltip")).toContainText(tooltips.Mission);
  await page.mouse.move(0, 0);

  await page.getByRole("button", { name: "Restart Program" }).click();
  expect(await termsInButtons(page)).toEqual([]);
  await expect(
    page.getByRole("dialog").locator("p [data-term='Program']"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep going" }).click();

  await launch.click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  expect(await termsInButtons(page)).toEqual([]);
  await endTurnAndContinue(page);
  expect(await termsInButtons(page)).toEqual([]);

  await page.reload();
  await expect(page.getByTestId("opening-screen")).toBeVisible();
  expect(await termsInButtons(page)).toEqual([]);
});

function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test("opens the Planning Mode heading's tooltip clear of Save, Load and Restart Program", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const heading = page.getByRole("heading", { name: "Planning Mode" });
  // An h1 explains the mode the player is already in, so it has no ⓘ marker: only its term opens a tooltip.
  await expect(heading.locator(".term-marker")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await heading.locator("[data-term]").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const shown = await tooltip.boundingBox();
  if (!shown) throw new Error("The tooltip isn't on screen");
  for (const name of ["Save", "Load", "Restart Program"]) {
    const button = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    if (!button) throw new Error(`${name} isn't on screen`);
    expect(overlap(shown, button), name).toBe(false);
  }
});

test("keeps a tooltip near the window's edge fully on screen", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  // Science is the status bar's last value, at the window's right-hand edge.
  await page.locator("dt [data-term='Science']").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toBeInViewport({ ratio: 1 });
});
