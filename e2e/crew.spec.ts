import { expect, test, type Page } from "@playwright/test";
import {
  endTurnWithoutLaunching,
  eventEntries,
  overrideProgramData,
  pauseAtEvent,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { colossusMoney, crewSeed } from "./seeds";

function launchVehicle(page: Page) {
  return page.getByRole("combobox", { name: "Launch Vehicle" });
}

function crewedMission(page: Page) {
  return page.getByRole("checkbox", { name: /Crewed Mission/ });
}

test("develops the Meridian Colossus, launches a Crewed Mission on it and sees its named Crew at Mars in the next Planning Mode", async ({
  page,
}) => {
  // Over 5 s: two Turns of Development, then a Turn played at 10x.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await page.goto(`/?seed=${crewSeed}`);
  await page
    .getByTestId("development")
    .filter({ hasText: "Meridian Colossus" })
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  await endTurnWithoutLaunching(page);
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("3");

  // Too heavy for the Meridian Heavy, even with the smallest Crew.
  await launchVehicle(page).selectOption("meridian-heavy");
  await crewedMission(page).check();
  await expect(page.getByRole("combobox", { name: "Crew size" })).toHaveValue(
    "2",
  );
  await expect(page.getByTestId("mission-mass")).toHaveText("9 of 8 tonnes");
  await expect(page.getByRole("alert")).toHaveText(
    "This Mission weighs 9 tonnes, but its Launch Vehicle can only carry 8 tonnes.",
  );
  // A larger Crew weighs and costs more, and earns more.
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("3");
  await expect(page.getByTestId("mission-mass")).toHaveText("10.5 of 8 tonnes");
  await expect(page.getByTestId("research-earnings")).toContainText(
    "Crew research earns 240 Science",
  );
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");

  await launchVehicle(page).selectOption("meridian-colossus");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("mission-mass")).toHaveText("9 of 16 tonnes");
  // The Meridian Colossus, still unproven, and the Crew.
  await expect(page.getByTestId("mission-cost")).toHaveText("$4.1B");
  await expect(page.getByTestId("crew-names")).toHaveText("Health 100 each");
  await expect(page.getByTestId("crew-names")).toHaveAttribute(
    "data-detail",
    "Flying: Amara Okafor, Lena Petrova, each starting at Health 100.",
  );
  await expect(page.getByTestId("research-earnings")).toContainText(
    "Crew research earns 160 Science",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(page, "Crew in Mars orbit", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await expect(
    eventEntries(page).filter({ hasText: "Crew in Mars orbit" }),
  ).toContainText(
    "Amara Okafor and Lena Petrova have arrived in Mars orbit aboard the Odyssey, and start Crew research.",
  );
  await expect(
    eventEntries(page).getByRole("heading", { name: "First Crew at Mars" }),
  ).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-crew")).toContainText(
    "Amara Okafor, in Mars orbit from this Turn: Health 100 of 100",
  );
  await expect(summary.getByTestId("summary-ongoing-research")).toContainText(
    "Crew in Mars orbit, Crew research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("4");
  const crew = page.getByTestId("crew-at-mars").getByRole("listitem");
  await expect(crew).toHaveText([
    /Crew in Mars orbit: Amara Okafor \(Health 100\), Lena Petrova \(Health 100\)/,
  ]);
  await expect(
    page.getByRole("combobox", { name: "Activity for the Crew in Mars orbit" }),
  ).toHaveValue("crew-research");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("keeps the Crew at Mars through saving and loading", async ({ page }) => {
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await page.goto(`/?seed=${crewSeed}`);
  await page
    .getByTestId("development")
    .filter({ hasText: "Meridian Colossus" })
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  await endTurnWithoutLaunching(page);
  await endTurnWithoutLaunching(page);
  await launchVehicle(page).selectOption("meridian-colossus");
  await crewedMission(page).check();
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  // The automatic save at the start of this Planning Mode holds the Crew.
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("crew-at-mars")).toContainText(
    "Amara Okafor (Health 100), Lena Petrova (Health 100)",
  );
});
