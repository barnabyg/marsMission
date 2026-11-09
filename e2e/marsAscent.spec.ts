import { expect, test } from "@playwright/test";
import {
  ascentSeed,
  fuelPlantColossusMoney,
  fuelPlantLandedSave,
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
import { endTurnAndContinue } from "./turnHelpers";

test.use({ viewport: missionViewport });

test("lands round-trip Crew beside a fuel plant and brings them home through Mars ascent on a later Turn", async ({
  page,
}) => {
  // Over 5 s: a Turn ended at once after the Crew's launch, then a Turn played to their splashdown.
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: fuelPlantColossusMoney,
  });
  await continueFromSave(page, fuelPlantLandedSave(ascentSeed));
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  await expect(page.getByTestId("ascent-propellant")).toContainText(
    "at Jezero Crater",
  );

  // Crew who land can go on a round trip, which brings Mars ascent and the rendezvous before the journey home.
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
  await page
    .getByRole("combobox", { name: "Crew destination" })
    .selectOption("landingSite");
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  await page
    .getByRole("combobox", { name: "Protection" })
    .selectOption("protection-light-shielding");
  await page.getByRole("checkbox", { name: "Round trip" }).check();
  await expect(
    page.getByTestId("homeward-events").getByTestId("mission-event"),
  ).toContainText([
    "Mars ascent",
    "Mars orbit rendezvous",
    "Trans-Earth injection",
    "Earth entry",
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);

  // The fuel plant has made enough ascent propellant at their site, so Planning Mode offers to bring them home.
  await expect(page.getByTestId("turn-number")).toHaveText("5");
  await expect(page.getByTestId("crew-at-mars")).toContainText("Jezero Crater");
  const bringHome = page.getByRole("checkbox", {
    name: "Bring Amara Okafor and Lena Petrova home",
  });
  await expect(bringHome).toBeEnabled();
  await bringHome.check();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Crew home",
    () =>
      page.getByRole("button", { name: "End Turn without launching" }).click(),
    "10x",
  );
  for (const name of [
    "Mars ascent",
    "Mars orbit rendezvous",
    "Trans-Earth injection",
  ]) {
    await expect(
      eventEntries(page).getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-crew-home")).toContainText(
    "Crew home safe, who won't fly again: Amara Okafor, Lena Petrova.",
  );
  await expect(summary.getByTestId("summary-ascent-propellant")).toContainText(
    /Jezero Crater: (Wellspring Fuel Plant made \d+\.\d t and )?Mars ascent used 20\.0 t, so it has \d+\.\d t/,
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("crew-at-mars")).toHaveCount(0);
  expect(problems).toEqual([]);
});
