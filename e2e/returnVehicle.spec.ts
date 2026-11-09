import { expect, test } from "@playwright/test";
import { colossusMoney, fetchSeed, oneWayCrewSave } from "./colossusSeeds";
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

test("fetches one-way Crew from a Phase 7 save with a return vehicle and brings them home on a later Turn", async ({
  page,
}) => {
  // Over 5 s: a Turn played to the return vehicle's arrival, then a Turn played to the Crew's splashdown.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, oneWayCrewSave(fetchSeed));
  await expect(page.getByTestId("turn-number")).toHaveText("4");

  // The Crew went one way, so nothing offers to bring them home until a return vehicle reaches them.
  await expect(page.getByRole("checkbox", { name: /^Bring / })).toHaveCount(0);
  const choice = page.getByTestId("return-vehicle-choice");
  await expect(choice).toContainText("$1B");
  await expect(choice).toContainText("3.5 t");
  await expect(choice).toContainText("room for 4");
  await choice.getByRole("checkbox", { name: /Return vehicle/ }).check();
  await expect(
    choice.getByRole("combobox", { name: "Crew to fetch" }),
  ).toHaveValue("mars-orbit");
  await expect(
    choice.getByRole("combobox", { name: "Crew to fetch" }),
  ).toContainText("Amara Okafor, Lena Petrova (Mars orbit)");
  // On its own, it fits the smallest Launch Vehicle, and buys the journey home's Mission Events now.
  await expect(page.getByTestId("mission-mass")).toHaveText("3.5 of 4 tonnes");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1.3B");
  await expect(
    page.getByTestId("homeward-events").getByTestId("mission-event"),
  ).toContainText(["Trans-Earth injection", "Earth entry"]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Homeward in Mars orbit",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "10x",
  );
  await expect(
    eventEntries(page).filter({
      has: page.getByRole("heading", {
        name: "Homeward in Mars orbit",
        exact: true,
      }),
    }),
  ).toContainText(
    "The Homeward waits in Mars orbit to bring Amara Okafor and Lena Petrova home on a later Turn.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: /^Skip to / }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-return-vehicle")).toHaveText(
    "Return vehicle Homeward in Mars orbit, waiting to bring home on a later Turn: Amara Okafor, Lena Petrova",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  // On the next Turn, they come home as round-trip Crew do.
  await expect(page.getByTestId("turn-number")).toHaveText("5");
  await expect(page.getByTestId("return-vehicle-choice")).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Bring Amara Okafor and Lena Petrova home",
    })
    .check();
  await pauseAtEvent(
    page,
    "Crew home",
    () =>
      page.getByRole("button", { name: "End Turn without launching" }).click(),
    "10x",
  );
  await expect(
    eventEntries(page).filter({
      has: page.getByRole("heading", { name: "Crew home", exact: true }),
    }),
  ).toContainText("Amara Okafor and Lena Petrova are home safe");
  await page.getByRole("button", { name: /^Skip to / }).click();
  await expect(
    page.getByTestId("turn-summary").getByTestId("summary-crew-home"),
  ).toContainText(
    "Crew home safe, who won't fly again: Amara Okafor, Lena Petrova",
  );
  expect(problems).toEqual([]);
});
