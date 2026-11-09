import { expect, test, type Locator, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { tooltips, type Term } from "../src/ui/tooltips";
import {
  chooseAssets,
  continueFromSave,
  eventEntries,
  holdTurnWhenShown,
  overrideProgramData,
  pauseAtEvent,
  termsInButtons,
  termsWithoutTooltips,
} from "./helpers";
import { endTurnAndContinue } from "./turnHelpers";
import { colossusBuiltSave, colossusMoney, crewSeed } from "./colossusSeeds";
import { landingSeed, pinpointLandingSeed, successSeed } from "./seeds";

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

async function expectTooltip(page: Page, term: Locator, name: Term) {
  await term.hover();
  await expect(page.getByRole("tooltip")).toContainText(tooltips[name]);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

test("explains the terms of Doing Science in Planning Mode and on the surface panel", async ({
  page,
}) => {
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByLabel("Activity for Pathfinder Orbiter")).toHaveValue(
    "survey",
  );
  await expectTooltip(
    page,
    page.getByLabel("Activity for Pathfinder Orbiter"),
    "Survey",
  );
  await expectTooltip(
    page,
    page.locator("[data-testid=chosen-asset] [data-term='Activity']").first(),
    "Activity",
  );

  await chooseAssets(page, ["Trailblazer Rover"]);
  await expectTooltip(
    page,
    page
      .getByTestId("activity-earnings")
      .locator("[data-term='Research Grant']")
      .first(),
    "Research Grant",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "Surface" }).click();
  await expect(page.getByTestId("surface-site")).toBeVisible();
  await expectTooltip(
    page,
    page.locator("h2 [data-term='Landing Site']"),
    "Landing Site",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(await termsInButtons(page)).toEqual([]);
});

test("explains each research Activity wherever Mission Mode names it", async ({
  page,
}) => {
  const researching = [
    [
      "pathfinder-orbiter",
      "Pathfinder Orbiter",
      "orbiter",
      null,
      "orbital-research",
    ],
    [
      "prospector-lander",
      "Prospector Lander",
      "lander",
      "jezero-crater",
      "surface-research",
    ],
    [
      "trailblazer-rover",
      "Trailblazer Rover",
      "rover",
      "jezero-crater",
      "soil-analysis",
    ],
    [
      "trailblazer-rover",
      "Trailblazer Rover",
      "rover",
      "jezero-crater",
      "long-traverse",
    ],
  ] as const;
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify({
        formatVersion: 6,
        program: {
          seed: successSeed,
          turnNumber: 9,
          date: "2045-01-01",
          moneyMillions: 5000,
          publicSupport: 500,
          science: 800,
          milestoneIds: [],
          landedSiteIds: ["jezero-crater"],
          knownLandingSiteIds: ["jezero-crater", "gale-crater"],
          surveyedLandingSiteIds: [],
          fundingThresholdsPaid: [],
          operatingAssets: researching.map(
            ([assetId, name, kind, landingSiteId, activityId], index) => ({
              assetId,
              name,
              kind,
              landingSiteId,
              activityId,
              arrivedOn: `204${index}-01-01`,
              serviceLifeDays: 9000,
              reliabilityLevelId: "none",
            }),
          ),
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await holdTurnWhenShown(page);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();

  const operating = page.getByTestId("operating-at-mars");
  // Two of a kind are numbered in the order they arrived, so that they can be told apart.
  await expect(operating).toContainText("Trailblazer Rover 1 at Jezero Crater");
  await expect(operating).toContainText("Trailblazer Rover 2 at Jezero Crater");
  await expect(operating).not.toContainText("Prospector Lander 1");
  for (const term of [
    "Orbital research",
    "Surface research",
    "Soil analysis",
    "Long traverse",
  ] as const) {
    await expectTooltip(page, operating.locator(`[data-term='${term}']`), term);
  }
  await page.getByRole("button", { name: "Surface" }).click();
  const surface = page.getByTestId("surface-status");
  await expect(surface).toBeVisible();
  for (const term of [
    "Surface research",
    "Soil analysis",
    "Long traverse",
  ] as const) {
    await expectTooltip(page, surface.locator(`[data-term='${term}']`), term);
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("explains the terms of technology in Planning Mode, Mission Mode and the Turn summary", async ({
  page,
}) => {
  await page.goto(`/?seed=${pinpointLandingSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const pinpoint = page.locator(".asset-choice", {
    hasText: "Pinpoint Lander",
  });
  await expectTooltip(
    page,
    pinpoint.getByTestId("technology-readiness"),
    "Technology Readiness",
  );
  await expectTooltip(
    page,
    page.locator("h2 [data-term='Development']"),
    "Development",
  );
  await chooseAssets(page, ["Pinpoint Lander"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Pinpoint Lander is Flight-proven",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "5x",
  );
  await expectTooltip(
    page,
    eventEntries(page)
      .filter({ hasText: "Pinpoint Lander is Flight-proven" })
      .locator("[data-term='Flight-proven']")
      .first(),
    "Flight-proven",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: /^Skip to / }).click();
  const proven = page.getByTestId("summary-flight-proven");
  await expect(proven).toHaveText("Now Flight-proven: Pinpoint Lander");
  await expectTooltip(
    page,
    proven.locator("[data-term='Flight-proven']"),
    "Flight-proven",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("explains the terms of Crew in Planning Mode, Mission Mode and the Turn summary", async ({
  page,
}) => {
  // Over 5 s: a Turn of a Crewed Mission, played to the Crew's arrival.
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, colossusBuiltSave(crewSeed));

  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
  const crewChoice = page.locator(".crew-choice");
  for (const term of [
    "Crewed Mission",
    "Crew size",
    "Supplies",
    "Protection",
  ] as const) {
    await expectTooltip(
      page,
      crewChoice.locator(`[data-term='${term}']`),
      term,
    );
  }
  await expectTooltip(page, page.getByTestId("crew-names"), "Health");
  const activity = page.getByRole("combobox", {
    name: "Activity for the Crew",
    exact: true,
  });
  await expectTooltip(page, activity, "Crew research");
  await page
    .getByRole("combobox", { name: "Crew destination" })
    .selectOption("landingSite");
  await expectTooltip(page, activity, "Field research");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page
    .getByRole("combobox", { name: "Crew destination" })
    .selectOption("marsOrbit");

  await pauseAtEvent(
    page,
    "Crew in Mars orbit",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "5x",
  );
  const arrived = eventEntries(page).filter({ hasText: "Crew in Mars orbit" });
  await expectTooltip(
    page,
    arrived.locator("[data-term='Crew']").first(),
    "Crew",
  );
  await expectTooltip(
    page,
    arrived.locator("[data-term='Crew research']"),
    "Crew research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: /^Skip to / }).click();
  const summary = page.getByTestId("turn-summary");
  await expectTooltip(
    page,
    summary
      .getByTestId("summary-health-lost")
      .locator("[data-term='Health']")
      .first(),
    "Health",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  const atMars = page.getByTestId("crew-at-mars");
  await expectTooltip(
    page,
    atMars.locator("[data-term='Supplies']"),
    "Supplies",
  );
  await expectTooltip(
    page,
    page.getByRole("combobox", { name: "Activity for the Crew in Mars orbit" }),
    "Crew research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
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
