import { expect, test, type Locator, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { tooltips, type Term } from "../src/ui/tooltips";
import {
  missionViewport,
  termsInButtons,
  termsWithoutTooltips,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { continueFromSave, overrideProgramData } from "./saveHelpers";
import {
  eventEntries,
  holdTurnWhenShown,
  pauseAtEvent,
} from "./playbackHelpers";
import { colossusBuiltSave, colossusMoney, crewSeed } from "./colossusSeeds";
import { landingSeed, pinpointLandingSeed, successSeed } from "./seeds";

// The tooltips of each area's game terms, wherever Planning Mode, Mission Mode and the Turn summary name them.

// These play Mission Mode, and what a tooltip says doesn't depend on the window's size.
test.use({ viewport: missionViewport });

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
