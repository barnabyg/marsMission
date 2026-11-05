import { expect, test, type Page } from "@playwright/test";
import { chooseAssets, termsWithoutTooltips } from "./helpers";
import { successSeed } from "./seeds";

/** Flies the first orbiter, whose Turn earns a Milestone and pays a Funding Threshold that covers the Mission's cost. */
async function flyFirstOrbiter(page: Page) {
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
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
  const changes = await summary.locator(".summary-changes").boundingBox();
  expect(changes?.width).toBeGreaterThan(width * 0.8);
});
