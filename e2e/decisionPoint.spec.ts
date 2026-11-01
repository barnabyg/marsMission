import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  eventEntries,
  holdSequence,
  surfaceAssets,
  watchForProblems,
} from "./helpers";
import {
  landingRescuedSeed,
  orbitInsertionRescuedSeed,
  orbitInsertionRescueFailsSeed,
} from "./seeds";

function decisionPoint(page: Page) {
  return page.getByTestId("decision-point");
}

function endTurn(page: Page) {
  return page.getByRole("button", { name: "End Turn", exact: true });
}

/** Launches the first Mission, with Reserve fuel if asked, which Planning Mode offers for the orbiter it starts with. */
async function launch(page: Page, seed: number, reserveFuel = true) {
  await page.goto(`/?seed=${seed}`);
  await page
    .getByRole("checkbox", { name: /Reserve fuel/ })
    .setChecked(reserveFuel);
  await page.getByRole("button", { name: "Launch Mission" }).click();
}

test("Planning Mode offers Reserve fuel only for a Mission with Mars orbit insertion, and counts it", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const reserveFuel = page.getByRole("checkbox", { name: /Reserve fuel/ });
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("mission-mass")).toHaveText("2.5 of 4 tonnes");
  await reserveFuel.check();
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.12B");
  await expect(page.getByTestId("mission-mass")).toHaveText("2.7 of 4 tonnes");

  await page.getByRole("checkbox", { name: /Pathfinder Orbiter/ }).uncheck();
  await page.getByRole("checkbox", { name: /Prospector Lander/ }).check();
  await expect(reserveFuel).toHaveCount(0);
});

test("using a Contingency that works saves the orbiter with a shorter Service Life", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await launch(page, orbitInsertionRescuedSeed);
  await page.getByRole("button", { name: "10x" }).click();

  await expect(decisionPoint(page)).toBeVisible();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(decisionPoint(page)).toContainText("Mars orbit insertion");
  await expect(page.getByTestId("decision-risk-band")).toContainText(
    "Over 30%",
  );
  await expect(decisionPoint(page)).toContainText("30% less Service Life");
  await expect(decisionPoint(page)).toContainText("35 Public Support");
  await expect(decisionPoint(page)).toContainText("20 Public Support");

  await decisionPoint(page)
    .getByRole("button", { name: /Use Reserve fuel/ })
    .click();
  await expect(decisionPoint(page)).toHaveCount(0);
  await expect(eventEntries(page).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Mars orbit insertion: saved by Reserve fuel",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("operating-at-mars")).toContainText(
    "Service Life cut to 910 days",
  );

  await endTurn(page).click();
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "saved by Reserve fuel",
  );
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "Pathfinder Orbiter now has a Service Life of 910 days",
  );
  await expect(page.getByTestId("summary-failure")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("operating-assets")).toContainText(
    "days of Service Life left",
  );
  expect(problems).toEqual([]);
});

test("using a Contingency that fails loses the orbiter and costs extra Public Support", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescueFailsSeed);
  await decisionPoint(page)
    .getByRole("button", { name: /Use Reserve fuel/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mars orbit insertion failed" }),
  ).toBeVisible();
  await endTurn(page).click();
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Public Support lost: 35",
  );
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "couldn't save the Mission",
  );
});

test("declining a Contingency takes the ordinary loss", async ({ page }) => {
  await launch(page, orbitInsertionRescuedSeed);
  await decisionPoint(page)
    .getByRole("button", { name: "Don't use it" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mars orbit insertion failed" }),
  ).toBeVisible();
  await endTurn(page).click();
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Public Support lost: 20",
  );
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "Reserve fuel not used",
  );
});

test("a failure with no Contingency bought raises no Decision Point", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescuedSeed, false);
  await page.getByRole("button", { name: "10x" }).click();
  await expect(
    page.getByRole("heading", { name: "Mars orbit insertion failed" }),
  ).toBeVisible();
  await expect(decisionPoint(page)).toHaveCount(0);
});

test("End Turn stops at the Decision Point, and works again once it's answered", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescuedSeed);
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();
  await expect(page.getByTestId("turn-summary")).toHaveCount(0);
  await expect(endTurn(page)).toBeDisabled();

  await decisionPoint(page)
    .getByRole("button", { name: /Use Reserve fuel/ })
    .click();
  await endTurn(page).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
});

test("no speed gets play past a Decision Point", async ({ page }) => {
  await launch(page, orbitInsertionRescuedSeed);
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();
  const date = await page.getByTestId("mission-date").innerText();

  for (const speed of ["1x", "5x", "10x"]) {
    await page.getByRole("button", { name: speed, exact: true }).click();
    await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  }
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("mission-date")).toHaveText(date);
  await expect(decisionPoint(page)).toBeVisible();
});

test("reloading during a Decision Point returns to the start of that Turn", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescuedSeed);
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
});

test("a Decision Point explains its terms", async ({ page }) => {
  await launch(page, orbitInsertionRescuedSeed);
  await endTurn(page).click();
  await expect(
    decisionPoint(page).locator("[data-term]", { hasText: "Decision Point" }),
  ).toBeVisible();
  await expect(
    decisionPoint(page).locator("[data-term]", { hasText: "Risk Band" }),
  ).toBeVisible();
});

test("a rescued landing shows its Decision Point first, then plays the landing, and the lander operates", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${landingRescuedSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await page.getByRole("checkbox", { name: /Retro thrusters/ }).check();
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "10x" }).click();

  await expect(decisionPoint(page)).toBeVisible();
  const view = page.getByTestId("solar-system-view");
  await expect(view).not.toHaveAttribute("data-sequence", /./);

  // The test build's Turns are so short that at 10x this one would end before anything could hold it.
  await page.getByRole("button", { name: "1x", exact: true }).click();
  const held = holdSequence(page, 500);
  await decisionPoint(page)
    .getByRole("button", { name: /Use Retro thrusters/ })
    .click();
  await held;
  await expect(view).toHaveAttribute("data-sequence", "landing");
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  await expect(surfaceAssets(page).first()).toContainText("Prospector Lander");
  await expect(page.getByTestId("operating-at-mars")).toContainText(
    "Service Life cut to 780 days",
  );

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "Prospector Lander now has a Service Life of 780 days",
  );
  await expect(page.getByTestId("summary-first-landing")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Prospector Lander at Jezero Crater",
  );
  expect(problems).toEqual([]);
});
