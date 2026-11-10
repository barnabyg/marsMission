import { expect, test, type Locator, type Page } from "@playwright/test";
import { missionViewport, termsWithoutTooltips } from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { whatScrolls } from "./layoutHelpers";
import { landingSeed, successSeed } from "./seeds";

test.use({ viewport: missionViewport });

/** Flies the first orbiter, whose Turn earns a Milestone and pays a Funding Threshold that covers the Mission's cost. */
async function flyFirstOrbiter(page: Page) {
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: /^Skip to / }).click();
  return page.getByTestId("turn-summary");
}

test("shows Money, Science and Public Support before and after, with the Money spent and received", async ({
  page,
}) => {
  const summary = await flyFirstOrbiter(page);

  // The Funding Threshold paid back the Mission's cost, which the lines show rather than leave a puzzle, and base
  // funding added $200M for Public Support of 100.
  await expect(summary.getByTestId("summary-money")).toHaveText(
    "$2.3B to $2.5B",
  );
  await expect(summary.getByTestId("summary-money-change")).toHaveText(
    "+$200M",
  );
  const spent = summary.getByTestId("summary-money-spent");
  const received = summary.getByTestId("summary-money-received");
  await expect(spent.getByTestId("summary-money-spent-total")).toHaveText(
    "−$1B",
  );
  await expect(spent.getByRole("listitem")).toHaveText(["Mission cost$1B"]);
  await expect(received.getByTestId("summary-money-received-total")).toHaveText(
    "+$1.2B",
  );
  await expect(received.getByRole("listitem")).toHaveText([
    "Funding Thresholds$1B",
    "Base funding$200M",
  ]);

  await expect(summary.getByTestId("summary-science")).toHaveText("0 to 100");
  const science = summary.getByTestId("summary-science-change");
  await expect(science).toHaveText("+100");
  await expect(science).toHaveClass(/\bup\b/);
  await expect(science.locator("svg.icon")).toBeVisible();
  await expect(science).toHaveCSS("color", "rgb(127, 209, 139)");
  await expect(summary.getByTestId("summary-public-support")).toHaveText(
    "100 to 255",
  );
  await expect(summary.getByTestId("summary-public-support-change")).toHaveText(
    "+155",
  );

  // Still listed below.
  await expect(summary.getByTestId("summary-survey")).toBeVisible();
  await expect(summary.getByTestId("summary-funding-payouts")).toContainText(
    "250 Public Support: $1B",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("shows the Milestone earned as a card with its reward, and uses the screen's width", async ({
  page,
}) => {
  const summary = await flyFirstOrbiter(page);

  const card = summary.getByTestId("summary-milestone");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading")).toContainText(
    "First orbiter at Mars",
  );
  await expect(card).toContainText("100 Science and 200 Public Support");
  await expect(card).toContainText("first spacecraft in orbit around Mars");
  await expect(card.locator("svg.milestone-icon")).toBeVisible();

  const width = page.viewportSize()?.width ?? 0;
  const changes = await summary.locator(".summary-cards").boundingBox();
  expect(changes?.width).toBeGreaterThan(width * 0.8);
});

/** Lands the first lander, whose Turn earns a Milestone, reaches a Funding Threshold and pays Research Grants. */
async function landFirstLander(page: Page) {
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: /^Skip to / }).click();
  return page.getByTestId("turn-summary");
}

test("puts everything in headed cards in the value cards' grid, and fits on one screen", async ({
  page,
}) => {
  const summary = await landFirstLander(page);
  await expect(summary.getByTestId("summary-milestone")).toHaveCount(1);
  await expect(summary.getByTestId("summary-funding-payouts")).toBeVisible();
  await expect(summary.getByTestId("summary-research-grants")).toBeVisible();

  // Nothing but the heading and the cards, each card with a heading of its own: no bare lines.
  await expect(summary.locator(":scope > *")).toHaveCount(2);
  const cards = summary.locator(".summary-cards > *");
  expect(await cards.count()).toBeGreaterThan(3);
  for (const card of await cards.all()) {
    await expect(card.locator(":scope > h2")).toHaveCount(1);
  }

  // The Milestone's card lines up under Money, in the same columns, and the Funding Threshold and Research Grants
  // share a card of their own.
  const money = await summary.locator(".value-change").first().boundingBox();
  const milestone = await summary
    .locator(".summary-card", { has: page.getByTestId("summary-milestone") })
    .boundingBox();
  expect(milestone?.x).toBe(money?.x);
  expect(milestone?.width).toBeCloseTo(money?.width ?? 0, 0);
  const moneyEarned = summary.getByTestId("summary-money-earned");
  await expect(
    moneyEarned.getByTestId("summary-funding-payouts"),
  ).toBeVisible();
  await expect(
    moneyEarned.getByTestId("summary-research-grants"),
  ).toBeVisible();

  expect(await whatScrolls(page)).toEqual([]);
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("keeps Continue in the same place at the top right, whatever the Turn's cards", async ({
  page,
  browser,
}) => {
  const continueBox = async (summary: Locator) => {
    const button = summary.getByRole("button", { name: "Continue" });
    await expect(button).toBeInViewport({ ratio: 1 });
    return button.boundingBox();
  };
  const orbiter = await continueBox(await flyFirstOrbiter(page));
  // A Program of its own, as this one's automatic save would be continued.
  const other = await browser.newPage({ viewport: missionViewport });
  const lander = await continueBox(await landFirstLander(other));
  await other.close();
  expect(lander).toEqual(orbiter);
  const width = page.viewportSize()?.width ?? 0;
  expect((orbiter?.x ?? 0) + (orbiter?.width ?? 0)).toBeGreaterThan(
    width * 0.9,
  );
  expect(orbiter?.y).toBeLessThan(200);
});
