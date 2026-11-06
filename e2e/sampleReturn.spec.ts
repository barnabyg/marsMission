import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  endTurnAndContinue,
  eventEntries,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { sampleReturnMoney, sampleReturnSeed } from "./sampleSeeds";

test.use({ viewport: missionViewport });

test("caches samples with a rover, sends them home with an ascent vehicle and an Earth return orbiter, and sees their Science in the Turn summary", async ({
  page,
}) => {
  // Three Turns, each ended at once, with the last played to the samples' splashdown.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: sampleReturnMoney });
  await page.goto(`/?seed=${String(sampleReturnSeed)}`);

  // A rover on Sample caching lands at Jezero Crater.
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-medium");
  await chooseAssets(page, ["Trailblazer Rover"]);
  await page
    .getByRole("combobox", { name: "Activity for Trailblazer Rover" })
    .selectOption("sample-caching");
  await expect(
    page.getByRole("combobox", { name: "Activity for Trailblazer Rover" }),
  ).toHaveAttribute(
    "title",
    /Over a whole Turn it collects \d+ samples, which earn \d+ Science once they reach Earth\./,
  );
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);

  // The samples wait at the site, and can't go home until an ascent vehicle is there.
  const waiting = page.getByTestId("samples-waiting");
  await expect(waiting).toContainText(
    /Samples at Jezero Crater: \d+, worth \d+ Science once home/,
  );
  const sendHome = page.getByRole("checkbox", {
    name: "Send the samples at Jezero Crater home",
  });
  await expect(sendHome).toBeDisabled();
  await expect(waiting.getByTestId("unavailable-reason")).toHaveText(
    "Samples at Jezero Crater need an ascent vehicle there to lift them into Mars orbit.",
  );
  // The Kestrel Lifter lands beside them and the Albatross Orbiter goes to Mars orbit, each buying its part of the
  // journey home.
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Kestrel Lifter", "Albatross Orbiter"]);
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  await expect(
    page.getByTestId("homeward-events").getByTestId("mission-event"),
  ).toContainText([
    "Mars ascent",
    "Mars orbit rendezvous",
    "Trans-Earth injection",
    "Earth entry",
  ]);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);

  // With both there, the samples can go home.
  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(sendHome).toBeEnabled();
  await sendHome.check();
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await pauseAtEvent(
    page,
    "Samples home",
    () =>
      page.getByRole("button", { name: "End Turn without launching" }).click(),
    "10x",
  );
  for (const name of [
    "Mars ascent",
    "Mars orbit rendezvous",
    "Trans-Earth injection",
    "Earth entry",
  ]) {
    await expect(
      eventEntries(page).getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-samples-home")).toContainText(
    /\d+ samples from Jezero Crater, brought home by the Albatross Orbiter: \d+ Science/,
  );
  await expect(summary).toContainText("First sample returned");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();
  // The samples have gone from the site, and what flew them has left Mars.
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  await expect(waiting).toHaveCount(0);
  await expect(page.getByTestId("operating-panel")).not.toContainText(
    "Kestrel Lifter",
  );
  expect(problems).toEqual([]);
});
