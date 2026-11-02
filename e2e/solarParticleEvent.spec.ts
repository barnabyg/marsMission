import { expect, test, type Page } from "@playwright/test";
import { watchForProblems } from "./helpers";
import { solarParticleEventSeed, solarParticleLossSeed } from "./seeds";

function decisionPoint(page: Page) {
  return page.getByTestId("decision-point");
}

function endTurn(page: Page) {
  return page.getByRole("button", { name: "End Turn", exact: true });
}

/** Launches the orbiter Planning Mode starts with, up to the solar particle event on its way. */
async function meetParticles(page: Page, seed: number) {
  await page.goto(`/?seed=${seed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();
}

test("a solar particle event stops play on the way to Mars, and safe mode shortens Service Life", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await meetParticles(page, solarParticleEventSeed);

  const panel = decisionPoint(page);
  await expect(panel).toContainText("Decision Point: Solar particle event");
  await expect(panel).toContainText("On board: Pathfinder Orbiter");
  await expect(page.getByTestId("decision-choice-safeMode")).toContainText(
    "10% of its Service Life",
  );
  await expect(page.getByTestId("decision-choice-carryOn")).toContainText(
    "Risk Band",
  );
  await expect(page.getByTestId("journey-progress")).toContainText(
    "of the way to Mars",
  );

  await panel.getByRole("button", { name: "Safe mode" }).click();
  await expect(
    page.getByRole("heading", { name: "Solar particle event: safe mode" }),
  ).toBeVisible();
  await endTurn(page).click();

  await expect(page.getByTestId("summary-solar-particle-event")).toContainText(
    "Safe mode protected Pathfinder Orbiter, and each lost 10% of its Service Life",
  );
  await expect(page.getByTestId("summary-failure")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  // The shortest Service Life, 1300 days, less a tenth, from arriving 210 days into a 780-day Turn.
  await expect(page.getByTestId("operating-assets")).toContainText(
    "600 days of Service Life left",
  );
  expect(problems).toEqual([]);
});

test("carrying on through a solar particle event can lose the Mission on the way", async ({
  page,
}) => {
  await meetParticles(page, solarParticleLossSeed);
  await decisionPoint(page).getByRole("button", { name: "Carry on" }).click();
  await expect(
    page.getByRole("heading", { name: "Solar particle event: Mission lost" }),
  ).toBeVisible();
  await endTurn(page).click();

  await expect(page.getByTestId("summary-solar-particle-event")).toContainText(
    "the radiation lost Pathfinder Orbiter",
  );
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Lost to: Solar particle event",
  );
  await expect(page.getByTestId("summary-failure")).toContainText(
    "Assets lost: Pathfinder Orbiter",
  );
});
