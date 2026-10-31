import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { termsWithoutTooltips, watchForProblems } from "./helpers";
import { orbiterLastsSeed, successSeed } from "./seeds";

test("sets a research Activity, sees what it earns, and sees the Science in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${orbiterLastsSeed}`);
  const activity = page.getByLabel("Activity for Pathfinder Orbiter");
  await expect(activity).toHaveValue("survey");
  await activity.selectOption("orbital-research");
  await expect(page.getByTestId("research-earnings")).toHaveText(
    "Ongoing Research for a whole Turn: Orbital research earns 40 Science and 5 Public Support.",
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
    "Pathfinder Orbiter, Orbital research: 30 Science and 4 Public Support over 570 days",
  );
  await expect(page.getByTestId("summary-survey")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // 100 Science for the first orbiter, plus the 30. (100 + 200 + 4) less 15% Public Support.
  await expect(page.getByTestId("science")).toHaveText("130");
  await expect(page.getByTestId("public-support")).toHaveText("258");
  await expect(
    page
      .getByTestId("operating-assets")
      .getByLabel("Activity for Pathfinder Orbiter"),
  ).toHaveValue("orbital-research");
  await expect(
    page
      .locator(".panel", { hasText: "Operating at Mars" })
      .getByTestId("research-earnings"),
  ).toContainText("Orbital research earns 40 Science");

  // Its Service Life ends with 330 days of this Turn gone, which is all it earns for.
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(earned).toContainText(
    "Pathfinder Orbiter, Orbital research: 17 Science and 3 Public Support over 330 days",
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
    "Ongoing Research for a whole Turn: Orbital research earns 40 Science and 5 Public Support. Surface research earns 60 Science and 8 Public Support.",
  );
  expect(problems).toEqual([]);
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
