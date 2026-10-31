import { expect, test, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { watchForProblems } from "./helpers";
import { orbiterLastsSeed } from "./seeds";

const { fundingThresholds, milestones } = realCatalogueFiles();
const firstScienceMilestone = milestones.find(
  ({ trigger }) => "totalScience" in trigger,
);

/** Opens Planning Mode in a saved Program, with no Assets at Mars. */
async function openProgram(
  page: Page,
  program: {
    publicSupport: number;
    science: number;
    fundingThresholdsPaid: number[];
  },
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify({
        formatVersion: 6,
        program: {
          seed: orbiterLastsSeed,
          turnNumber: 3,
          date: "2033-02-08",
          moneyMillions: 3000,
          milestoneIds: [],
          landedSiteIds: [],
          knownLandingSiteIds: ["jezero-crater", "gale-crater"],
          surveyedLandingSiteIds: [],
          operatingAssets: [],
          status: { kind: "active" },
          ...program,
        },
      }),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("3");
}

test("a Program past a Science Milestone earns it in a Turn with no Mission, once, and a Funding Threshold pays with it", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const milestone = firstScienceMilestone;
  const trigger = milestone?.trigger;
  const totalScience =
    trigger && "totalScience" in trigger ? trigger.totalScience : 0;
  const threshold = fundingThresholds[0];
  await openProgram(page, {
    science: totalScience,
    // Just short of the Funding Threshold without the Milestone's Public Support.
    publicSupport: (threshold?.publicSupport ?? 0) - 1,
    fundingThresholdsPaid: [],
  });
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();

  const events = page.getByTestId("events-column");
  await expect(events).toContainText(milestone?.name ?? "");
  await expect(events).toContainText(
    `Funding Threshold reached: ${threshold?.publicSupport} Public Support`,
  );
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByTestId("summary-funding-payouts")).toContainText(
    `${threshold?.publicSupport} Public Support`,
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("milestones")).toContainText(
    milestone?.name ?? "",
  );

  // It isn't awarded or paid again in the next Turn.
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await expect(page.getByTestId("events-column")).not.toContainText(
    milestone?.name ?? "",
  );
  await expect(page.getByTestId("events-column")).not.toContainText(
    "Funding Threshold reached",
  );
  expect(problems).toEqual([]);
});

test("the next Funding Threshold moves along the list, and then there are none left", async ({
  page,
}) => {
  const levels = fundingThresholds.map(({ publicSupport }) => publicSupport);
  const [first, second] = levels;
  await openProgram(page, {
    science: 0,
    publicSupport: 100,
    fundingThresholdsPaid: first === undefined ? [] : [first],
  });
  await expect(page.getByTestId("next-funding-threshold")).toContainText(
    `at ${second} (${(second ?? 0) - 100} away)`,
  );

  await page.goto("about:blank");
  await openProgram(page, {
    science: 0,
    publicSupport: 100,
    fundingThresholdsPaid: levels,
  });
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "None left",
  );
});

test("a saved Program already above a level not yet paid shows it as no points away", async ({
  page,
}) => {
  const [first] = fundingThresholds;
  await openProgram(page, {
    science: 0,
    publicSupport: (first?.publicSupport ?? 0) + 40,
    fundingThresholdsPaid: [],
  });
  await expect(page.getByTestId("next-funding-threshold")).toContainText(
    `at ${first?.publicSupport} (0 away)`,
  );
});
