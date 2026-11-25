import { expect, test, type Page } from "@playwright/test";
import { missionViewport, watchForProblems } from "./helpers";
import { holdSceneAt } from "./playbackHelpers";
import { continueFromSave, overrideProgramData } from "./saveHelpers";
import {
  sampleDepartureDecisionSave,
  sampleFailureSeed,
  sampleReturnMoney,
  samplesReadySave,
} from "./sampleSeeds";

test.use({ viewport: missionViewport });

async function prepareSamples(page: Page, save: string) {
  await overrideProgramData(page, { startingMoneyMillions: sampleReturnMoney });
  await continueFromSave(page, save);
  await page
    .getByRole("checkbox", { name: "Send the samples at Jezero Crater home" })
    .check();
}

for (const [event, attribute, ending] of [
  ["Mars orbit rendezvous", "marsRendezvous", "missed"],
  ["Trans-Earth injection", "homewardDeparture", "stranded"],
  ["Earth entry", "earthEntry", "brokenUp"],
] as const) {
  test(`shows the samples' failed ${event} and records the loss in the summary`, async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await prepareSamples(page, samplesReadySave(sampleFailureSeed(event)));
    const ended = holdSceneAt(page, attribute, ending);
    await page
      .getByRole("button", { name: "End Turn without launching" })
      .click();
    const fast = page.getByRole("button", { name: "20x", exact: true });
    await fast.click();
    await ended;
    await expect(page.getByTestId("spacecraft-status")).toContainText(
      `${event} failed`,
    );
    if (ending === "stranded") {
      await expect(page.getByTestId("spacecraft-asset")).toHaveText(
        "Albatross Orbiter",
      );
      await expect(page.getByTestId("spacecraft-status")).toContainText(
        "leaving the samples in Mars orbit",
      );
      await page
        .getByRole("button", { name: "Skip scene", exact: true })
        .click();
      await expect(page.getByTestId("current-view")).toHaveText("Mars orbit");
    }
    await fast.click();
    const events = page.getByTestId("summary-mission-event");
    await expect(events.last()).toContainText(`${event} failed`);
    await expect(events.last()).toHaveAttribute("data-outcome", "failure");
    await expect(page.getByTestId("summary-samples-lost")).toBeVisible();
    expect(problems).toEqual([]);
  });
}

test("holds the departure Decision Point until the player uses the Backup engine and then brings the samples home", async ({
  page,
}) => {
  await prepareSamples(page, sampleDepartureDecisionSave());
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page.getByRole("button", { name: "Skip to Decision Point" }).click();
  const use = page.getByRole("button", { name: /Use Backup engine/ });
  await expect(use).toBeVisible();
  const scene = page.getByTestId("mission-scene");
  await expect(scene).not.toHaveAttribute("data-homeward-departure", /.+/);
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  const departing = holdSceneAt(page, "homewardDeparture", "departing");
  await use.click();
  await departing;
  await expect(page.getByTestId("spacecraft-status")).toContainText(
    "carries the samples out of Mars orbit",
  );
  await page.getByRole("button", { name: "20x", exact: true }).click();
  await expect(page.getByTestId("summary-samples-home")).toBeVisible();
  await expect(page.getByTestId("summary-mission-events")).toContainText(
    "Trans-Earth injection: saved by Backup engine",
  );
});
