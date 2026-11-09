import { expect, test } from "@playwright/test";
import {
  colossusBuiltSave,
  colossusMoney,
  roundTripSeed,
} from "./colossusSeeds";
import {
  continueFromSave,
  eventEntries,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";

test.use({ viewport: missionViewport });

test("sends round-trip Crew to Mars orbit and brings them home on a later Turn", async ({
  page,
}) => {
  // Over 5 s: a Turn played to the Crew's arrival, then a Turn played to their splashdown.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, colossusBuiltSave(roundTripSeed));

  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
  const roundTrip = page.getByRole("checkbox", { name: "Round trip" });
  await expect(roundTrip).not.toBeChecked();
  await expect(page.getByTestId("mission-mass")).toHaveText(
    "11.5 of 16 tonnes",
  );
  await expect(page.getByTestId("mission-cost")).toHaveText("$4.2B");
  await expect(page.getByTestId("homeward-events")).toHaveCount(0);

  // The Earth return stage adds its mass and cost, and the journey home's Mission Events are bought now.
  await expect(page.getByText("Round trip (+$600M, +1.5 t)")).toBeVisible();
  await roundTrip.check();
  await expect(page.getByTestId("mission-mass")).toHaveText("13 of 16 tonnes");
  await expect(page.getByTestId("mission-cost")).toHaveText("$4.8B");
  await expect(
    page.getByTestId("homeward-events").getByTestId("mission-event"),
  ).toContainText(["Trans-Earth injection", "Earth entry"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Crew in Mars orbit",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "10x",
  );
  await page.getByRole("button", { name: /^Skip to / }).click();
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  // On the next Turn, Planning Mode offers to bring them home, with or without a new Mission.
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  const bringHome = page.getByRole("checkbox", {
    name: "Bring Amara Okafor and Lena Petrova home",
  });
  await expect(bringHome).not.toBeChecked();
  await bringHome.check();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Crew home",
    () =>
      page.getByRole("button", { name: "End Turn without launching" }).click(),
    "10x",
  );
  await expect(
    eventEntries(page).getByRole("heading", {
      name: "Trans-Earth injection",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    eventEntries(page).filter({
      has: page.getByRole("heading", { name: "Crew home", exact: true }),
    }),
  ).toContainText(
    "Amara Okafor and Lena Petrova are home safe, which earns 200 Public Support. They won't fly again.",
  );
  await expect(
    eventEntries(page).getByRole("heading", { name: "First Crew home" }),
  ).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: /^Skip to / }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-crew-home")).toHaveText(
    "Crew home safe, who won't fly again: Amara Okafor, Lena Petrova. Public Support earned: 200",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("5");
  await expect(page.getByTestId("crew-at-mars")).toHaveCount(0);
  await expect(page.getByTestId("milestones")).toContainText("First Crew home");
  expect(problems).toEqual([]);
});
