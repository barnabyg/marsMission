import { expect, test, type Locator, type Page } from "@playwright/test";
import { tooltips, type Term } from "../src/ui/tooltips";
import { chooseAssets, termsWithoutTooltips } from "./helpers";
import { successSeed } from "./seeds";

/** Which game terms are underlined where, and which headings carry an ⓘ marker (src/ui/repeatedTerms.ts). */

async function expectTooltip(page: Page, term: Locator, name: Term) {
  await term.hover();
  await expect(page.getByRole("tooltip")).toContainText(tooltips[name]);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

/** The terms under the locator that show an underline, each as often as it shows one. */
function underlinedTerms(scope: Locator): Promise<string[]> {
  return scope
    .locator(".term")
    .evaluateAll((terms) =>
      terms
        .filter((term) => getComputedStyle(term).borderBottomStyle !== "none")
        .map((term) => term.getAttribute("data-term") ?? ""),
    );
}

test("underlines each game term once in the New Mission panel, and none in a heading", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  const panel = page.locator(".mission-panel");
  await expect(panel.getByTestId("landing-site-details")).toBeVisible();
  const underlined = await underlinedTerms(panel);
  expect(underlined.length).toBeGreaterThan(5);
  expect(underlined).toEqual([...new Set(underlined)]);
  // Later appearances keep their tooltips and help cursor.
  const missions = panel.locator(".term[data-term='Mission']");
  expect(await missions.count()).toBeGreaterThan(1);
  await expect(missions.last()).toHaveCSS("cursor", "help");
  await expectTooltip(page, missions.last(), "Mission");

  expect(await underlinedTerms(page.locator("h1, h2, h3, h4"))).toEqual([]);
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("explains a heading's terms from its ⓘ marker only while its body doesn't name them", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const heading = page.getByRole("heading", {
    name: "Mission Events, Reliability and Contingency",
  });
  await expect(heading).toHaveText(
    "4Mission Events, Reliability and Contingency",
  );
  // With nothing ticked, the step is only its heading and why it's closed, so the heading is the one place its terms are.
  const marker = heading.locator(".term-marker");
  await expect(marker).toBeVisible();
  await marker.hover();
  const tooltip = page.getByRole("tooltip");
  for (const term of ["Mission Event", "Reliability", "Contingency"] as const) {
    await expect(tooltip).toContainText(tooltips[term]);
  }
  await page.mouse.move(0, 0);

  // The New Mission panel's body underlines "Mission" in its steps' notes, so its heading needs no marker, while the
  // open Mission Events step still does: its body names each Mission Event, not the term.
  await expect(
    page
      .getByRole("heading", { name: "New Mission", exact: true })
      .locator(".term-marker"),
  ).toBeHidden();
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("mission-event").first()).toBeVisible();
  await expect(marker).toBeVisible();
  // Headings without game terms have no marker.
  await expect(
    page
      .getByRole("heading", { name: "Operating at Mars" })
      .locator(".term-marker"),
  ).toHaveCount(0);
});

for (const size of [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test.describe(`at ${String(size.width)}×${String(size.height)}`, () => {
    test.use({ viewport: size });

    test("shows a new Program's Planning Mode with few ⓘ markers and no underlines in the status bar", async ({
      page,
    }) => {
      await page.goto(`/?seed=${successSeed}`);
      await expect(page.getByTestId("turn-number")).toHaveText("1");
      await expect(page.getByTestId("tutorial-offer")).toBeVisible();
      const markers = page.locator(".term-marker:visible");
      expect(await markers.count()).toBeLessThanOrEqual(3);
      await expect(page.locator("h1 .term-marker")).toHaveCount(0);

      // The status bar's labels keep their tooltips, but the icons and the bar's place already set them apart.
      const bar = page.locator(".status-bar");
      expect(await underlinedTerms(bar)).toEqual([]);
      const label = bar.locator("dt [data-term='Launch Window']");
      await expect(label).toHaveCSS("cursor", "help");
      await expectTooltip(page, label, "Launch Window");
      expect(await termsWithoutTooltips(page)).toEqual([]);
    });
  });
}
