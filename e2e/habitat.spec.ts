import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  continueFromSave,
  missionViewport,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { colossusBuiltSave, colossusMoney, habitatSeed } from "./colossusSeeds";

test.use({ viewport: missionViewport });

test("lands Crew beside a habitat and sees the Health it saved them in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, colossusBuiltSave(habitatSeed));

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

  // Its Benefit tag says how many more days a Crew member would last beside it, and its tooltip what it does.
  const card = page.locator(".asset-choice", { hasText: "Haven Module" });
  const tag = card.getByTestId("benefit-tag");
  await expect(tag).toHaveText(/^Benefit \+[\d,]+ days$/);
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Haven Module: Houses the Crew at its Landing Site",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "kg of Supplies, which the Crew there draw on once their own run out",
  );
  await chooseAssets(page, ["Haven Module"]);
  await expect(
    card.getByRole("combobox", { name: "Activity for Haven Module" }),
  ).toHaveValue("habitation");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("turn-summary");
  // Living in the habitat slowed the Health they lost to time at Mars.
  await expect(summary.getByTestId("summary-health-lost")).toContainText(
    /Amara Okafor lost \d+ Health: .*\d+ to time at Mars\. Living in a Habitat saved \d+ more/,
  );
  await summary
    .getByTestId("summary-health-lost")
    .getByText("Habitat", { exact: true })
    .first()
    .hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "An Asset that lands at a Landing Site and houses the Crew there",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  // Its Supplies stay full beside the Crew, whose own last them longer than the habitat's.
  await expect(page.getByTestId("habitat-supplies")).toHaveText(
    "Supplies in Habitats: 1,500 kg at Jezero Crater",
  );
  await expect(
    page.getByTestId("crew-at-mars").getByRole("listitem"),
  ).toContainText([/Crew in Jezero Crater: .*Supplies for [\d,]+ days/]);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});
