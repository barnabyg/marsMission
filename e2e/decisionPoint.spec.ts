import { expect, test, type Page } from "@playwright/test";
import { missionViewport, watchForProblems } from "./helpers";
import { chooseAssets } from "./planningHelpers";
import {
  eventEntries,
  holdSequence,
  holdTurnWhenShown,
  pauseAtEvent,
  surfaceAssets,
} from "./playbackHelpers";
import {
  landingRescuedSeed,
  orbitInsertionRescuedSeed,
  orbitInsertionRescueFailsSeed,
} from "./seeds";

test.use({ viewport: missionViewport });

function decisionPoint(page: Page) {
  return page.getByTestId("decision-point");
}

function endTurn(page: Page) {
  return page.getByRole("button", { name: /^Skip to / });
}

/** Launches the first Mission, with Reserve fuel if asked, which Planning Mode offers for the orbiter it starts with. */
async function launch(page: Page, seed: number, reserveFuel = true) {
  await page.goto(`/?seed=${seed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page
    .getByRole("checkbox", { name: /Reserve fuel/ })
    .setChecked(reserveFuel);
  await page.getByRole("button", { name: "Launch Mission" }).click();
}

test("Planning Mode offers Reserve fuel only for a Mission with Mars orbit insertion, and counts it", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const reserveFuel = page.getByRole("checkbox", { name: /Reserve fuel/ });
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("mission-mass")).toHaveText("2.5 of 4 tonnes");
  // The Contingency is named once, over the list, and its label says what it costs and its Risk Band if used.
  await expect(
    page.getByText("On the way, once each, with a Contingency for some"),
  ).toBeVisible();
  await expect(reserveFuel).toHaveAccessibleName(
    /^Reserve fuel · \$80M · 0\.2 t · (~\d+%|Over \d+%) if used$/,
  );
  // Each Reliability is its name and cost; the Risk Band it leaves is beside the choice, and said only there.
  const insertion = page
    .getByTestId("mission-event")
    .filter({ hasText: "Mars orbit insertion" });
  await expect(insertion.getByRole("option").first()).toHaveText("None ($0M)");
  for (const option of await insertion.getByRole("option").allTextContents()) {
    expect(option).toMatch(/^[\w ]+ \(\$[\d.]+[MB]\)$/);
  }
  await reserveFuel.check();
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.08B");
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
  // Skipped there rather than played at 10x, so that play goes on at 1x once it's answered: the test build's Turns are so
  // short that at 10x this one would end before anything could hold it, and no speed can be picked at a Decision Point.
  await page.getByRole("button", { name: "Skip to Decision Point" }).click();

  await expect(decisionPoint(page)).toBeVisible();
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(decisionPoint(page)).toContainText("Mars orbit insertion");
  await expect(page.getByTestId("decision-risk-band")).toContainText(
    "Over 30%",
  );
  await expect(decisionPoint(page)).toContainText("30% less Service Life");
  // One orbiter is lost, not "are lost".
  await expect(decisionPoint(page)).toContainText(
    "Pathfinder Orbiter is lost, and it costs 20 Public Support.",
  );
  await expect(decisionPoint(page)).toContainText("35 Public Support");
  await expect(decisionPoint(page)).toContainText("20 Public Support");

  // At 10x the Turn can end before the checks below finish, taking the skip button with it, so it holds when the answer shows.
  await holdTurnWhenShown(page, "Mars orbit insertion: saved by Reserve fuel");
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
  await expect(page.getByTestId("operating-asset").first()).toContainText(
    /\d days/,
  );
  expect(problems).toEqual([]);
});

test("using a Contingency that fails loses the orbiter and costs extra Public Support", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescueFailsSeed);
  await endTurn(page).click();
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
  await endTurn(page).click();
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
  // Held from inside the page as the failure shows, as at 10x a busy machine can reach the Turn's end before a check.
  await pauseAtEvent(page, "Mars orbit insertion failed", () =>
    page.getByRole("button", { name: "10x" }).click(),
  );
  await expect(decisionPoint(page)).toHaveCount(0);
});

test("skips to the Decision Point, then once it's answered to the Turn summary, which lists the Turn's Mission Events", async ({
  page,
}) => {
  await launch(page, orbitInsertionRescuedSeed);
  const toDecision = page.getByRole("button", {
    name: "Skip to Decision Point",
  });
  await expect(toDecision).toHaveAttribute("title", /which you must answer/);
  await toDecision.click();
  await expect(decisionPoint(page)).toBeVisible();
  await expect(page.getByTestId("turn-summary")).toHaveCount(0);
  await expect(toDecision).toBeDisabled();
  // Only an answer moves play on, so the speeds can't be used either, and each says why, as Skip does.
  const speeds = page.getByRole("group", { name: "Speed" });
  for (const name of ["1x", "5x", "10x", "20x"]) {
    const speed = speeds.getByRole("button", { name });
    await expect(speed).toHaveAttribute("aria-disabled", "true");
    await expect(speed).toHaveAccessibleDescription(
      "Play is held at the Decision Point until you answer it.",
    );
  }
  await expect(toDecision).toHaveAccessibleDescription(
    "Play is held at the Decision Point until you answer it.",
  );
  // Nor do their keys.
  await page.keyboard.press("2");
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");

  await decisionPoint(page)
    .getByRole("button", { name: /Use Reserve fuel/ })
    .click();
  await page.getByRole("button", { name: "Skip to Turn summary" }).click();
  await expect(page.getByTestId("turn-summary")).toBeVisible();
  await expect(page.getByTestId("summary-mission-event")).toHaveText([
    /^Launch\b/,
    /^Mars transfer burn\b/,
    /^Mars orbit insertion: saved by Reserve fuel\b/,
  ]);
});

test("no speed gets play past a Decision Point", async ({ page }) => {
  await launch(page, orbitInsertionRescuedSeed);
  await endTurn(page).click();
  await expect(decisionPoint(page)).toBeVisible();
  const date = await page.getByTestId("mission-date").innerText();

  // The speeds say they can't be used here; forced, a click on one still changes nothing.
  for (const speed of ["1x", "5x", "10x", "20x"]) {
    await page
      .getByRole("button", { name: speed, exact: true })
      .click({ force: true });
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
  // Skipped there rather than played at 10x, so that play goes on at 1x once it's answered: the test build's Turns are so
  // short that at 10x this one would end before anything could hold it, and no speed can be picked at a Decision Point.
  await page.getByRole("button", { name: "Skip to Decision Point" }).click();

  await expect(decisionPoint(page)).toBeVisible();
  const scene = page.getByTestId("mission-scene");
  await expect(scene).not.toHaveAttribute("data-sequence", /./);

  const held = holdSequence(page, 500);
  await decisionPoint(page)
    .getByRole("button", { name: /Use Retro thrusters/ })
    .click();
  await held;
  await expect(scene).toHaveAttribute("data-sequence", "landing");
  await expect(page.getByTestId("current-view")).toHaveText("Surface");

  await expect(surfaceAssets(page).first()).toContainText("Prospector Lander");
  // Once it has landed, the Landing Site's own list says its Service Life was cut.
  const landed = holdSequence(page);
  await page.getByRole("button", { name: "1x" }).click();
  await landed;
  await expect(page.getByTestId("surface-status")).toContainText(
    "Prospector Lander (lander): Surface research, Service Life cut to 780 days",
  );
  // Landed at Jezero Crater, the lander is named once in the whole info box, and nothing else is at Mars.
  expect(
    (await page.getByTestId("mission-info").innerText()).split(
      "Prospector Lander",
    ),
  ).toHaveLength(2);
  await expect(page.getByTestId("operating-at-mars")).toHaveCount(0);

  await page.getByRole("button", { name: /^Skip to / }).click();
  await expect(page.getByTestId("summary-contingencies")).toContainText(
    "Prospector Lander now has a Service Life of 780 days",
  );
  await expect(page.getByTestId("summary-first-landing")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Jezero Crater",
  );
  await expect(page.getByTestId("operating-asset")).toContainText(
    "Prospector Lander",
  );
  expect(problems).toEqual([]);
});
