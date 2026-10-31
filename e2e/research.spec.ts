import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import {
  chooseAssets,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { landingSeed, orbiterLastsSeed, successSeed } from "./seeds";

test("sets a research Activity, sees what it earns, and sees the Science in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterLastsSeed}`);
  const activity = page.getByLabel("Activity for Pathfinder Orbiter");
  await expect(activity).toHaveValue("survey");
  await activity.selectOption("orbital-research");
  await expect(page.getByTestId("research-earnings")).toHaveText(
    "Ongoing Research for a whole Turn: Orbital research earns 80 Science and 6 Public Support.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter: Orbital research",
  );
  await page.getByRole("button", { name: "End Turn", exact: true }).click();

  // It arrives on day 210, so 570 of the Turn's 780 days earn their share, rounded up.
  const earned = page.getByTestId("summary-ongoing-research");
  await expect(earned).toContainText(
    "Pathfinder Orbiter, Orbital research: 59 Science and 5 Public Support over 570 days",
  );
  await expect(page.getByTestId("summary-survey")).toHaveCount(0);
  // Orbital research has a zero rate, so it pays no Research Grant.
  await expect(page.getByTestId("summary-research-grants")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // 100 Science for the first orbiter, plus the 59. (100 + 200 + 5) less 15% Public Support.
  await expect(page.getByTestId("science")).toHaveText("159");
  await expect(page.getByTestId("public-support")).toHaveText("259");
  await expect(
    page
      .getByTestId("operating-assets")
      .getByLabel("Activity for Pathfinder Orbiter"),
  ).toHaveValue("orbital-research");
  await expect(
    page
      .locator(".panel", { hasText: "Operating at Mars" })
      .getByTestId("research-earnings"),
  ).toContainText("Orbital research earns 80 Science");

  // Its Service Life ends with 730 days of this Turn gone, which is all it earns for.
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(earned).toContainText(
    "Pathfinder Orbiter, Orbital research: 75 Science and 6 Public Support over 730 days",
  );
  await expect(page.getByTestId("summary-assets-ended")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(problems).toEqual([]);
});

test("a lander starts on research, shown beside an orbiter's choices when both are chosen", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const orbiterBox = page.locator(".asset-choice", {
    hasText: "Pathfinder Orbiter",
  });
  await expect(orbiterBox.getByRole("combobox").first()).toHaveValue("survey");
  await page
    .locator(".asset-choice", { hasText: "Prospector Lander" })
    .getByRole("checkbox")
    .check();
  await expect(page.getByLabel("Activity for Prospector Lander")).toHaveValue(
    "surface-research",
  );
  await expect(page.getByTestId("research-earnings")).toHaveText(
    "Ongoing Research for a whole Turn: Orbital research earns 80 Science and 6 Public Support. Surface research earns 100 Science and 9 Public Support, and pays a $50M Research Grant.",
  );
  expect(problems).toEqual([]);
});

test("sees which research pays a Research Grant, then sees it paid and the money rise on the next Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${landingSeed}`);
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(page.getByTestId("research-earnings")).toHaveText(
    "Ongoing Research for a whole Turn: Surface research earns 100 Science and 9 Public Support, and pays a $50M Research Grant.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();

  // The days left after landing earn 73 Science, which pays half of that in millions.
  await expect(page.getByTestId("summary-ongoing-research")).toContainText(
    "Prospector Lander, Surface research: 73 Science",
  );
  const grants = page.getByTestId("summary-research-grants");
  await expect(grants.getByRole("heading")).toHaveText(
    "Research Grants for this Turn: $37M",
  );
  await expect(grants.getByRole("listitem")).toHaveText(
    "Prospector Lander: $37M",
  );
  // Listed apart from the Funding Threshold that the same Turn reaches.
  await expect(page.getByTestId("summary-funding-payouts")).toContainText(
    "250 Public Support: $1B",
  );
  await expect(grants).not.toContainText("$1B");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // $2.3B less the $1.1B Mission, plus the $1B payout and the $37M Research Grant.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("money")).toHaveText("$2.237B");
  expect(problems).toEqual([]);
});

test("says when an Asset is set to Survey and nothing is left to Survey", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const siteIds = realCatalogueFiles().landingSites.map(({ id }) => id);
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
          turnNumber: 6,
          date: "2040-01-01",
          moneyMillions: 5000,
          publicSupport: 500,
          science: 800,
          milestoneIds: [],
          landedSiteIds: [],
          knownLandingSiteIds: siteIds,
          surveyedLandingSiteIds: siteIds,
          fundingThresholdsPaid: [],
          operatingAssets: [
            {
              assetId: "pathfinder-orbiter",
              name: "Pathfinder Orbiter",
              kind: "orbiter",
              landingSiteId: null,
              activityId: "survey",
              arrivedOn: "2038-01-01",
              serviceLifeDays: 9000,
              reliabilityLevelId: "none",
            },
          ],
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();

  const note = page.getByTestId("nothing-left-to-survey");
  const operatingPanel = page.locator(".panel", {
    hasText: "Operating at Mars",
  });
  const missionPanel = page.locator(".panel", { hasText: "Launch Vehicle" });
  const noteText =
    "Nothing is left to Survey, so an Asset set to Survey does nothing.";
  // The Mission starts with an orbiter, which starts on Survey too.
  await expect(note).toHaveCount(2);
  await expect(operatingPanel.getByTestId("nothing-left-to-survey")).toHaveText(
    noteText,
  );
  await expect(missionPanel.getByTestId("nothing-left-to-survey")).toHaveText(
    noteText,
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Each goes when its Asset is given something else to do.
  await operatingPanel
    .getByLabel("Activity for Pathfinder Orbiter")
    .selectOption("orbital-research");
  await expect(
    operatingPanel.getByTestId("nothing-left-to-survey"),
  ).toHaveCount(0);
  await expect(note).toHaveCount(1);
  await missionPanel
    .getByLabel("Activity for Pathfinder Orbiter")
    .selectOption("orbital-research");
  await expect(note).toHaveCount(0);

  // And comes back with it, or goes if the Asset leaves the Mission.
  await missionPanel
    .getByLabel("Activity for Pathfinder Orbiter")
    .selectOption("survey");
  await expect(note).toHaveCount(1);
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(note).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("with something left to Survey, an Asset set to Survey has no such note", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await expect(page.getByLabel("Activity for Pathfinder Orbiter")).toHaveValue(
    "survey",
  );
  await expect(page.getByTestId("nothing-left-to-survey")).toHaveCount(0);
});

test("a lander from an old save carries on with Nothing, and can then be set to research", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify({
        formatVersion: 5,
        program: {
          seed: successSeed,
          turnNumber: 2,
          date: "2031-01-19",
          moneyMillions: 2000,
          publicSupport: 200,
          science: 100,
          milestoneIds: [],
          landedSiteIds: ["jezero-crater"],
          knownLandingSiteIds: ["jezero-crater", "gale-crater"],
          surveyedLandingSiteIds: [],
          fundingThresholdsPaid: [],
          operatingAssets: [
            {
              assetId: "prospector-lander",
              name: "Prospector Lander",
              kind: "lander",
              arrivedOn: "2029-07-05",
              landingSiteId: "jezero-crater",
              serviceLifeDays: 1500,
              reliabilityLevelId: "none",
            },
          ],
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();

  const activity = page
    .getByTestId("operating-assets")
    .getByLabel("Activity for Prospector Lander");
  await expect(activity).toHaveValue("nothing");
  await activity.selectOption("surface-research");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  // Whether it lasts the whole Turn is down to its roll, so this only checks that it earned.
  await expect(page.getByTestId("summary-ongoing-research")).toContainText(
    /Prospector Lander, Surface research: \d+ Science/,
  );
  expect(problems).toEqual([]);
});
