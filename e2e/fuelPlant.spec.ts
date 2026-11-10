import { expect, test } from "@playwright/test";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { overrideProgramData } from "./saveHelpers";
import { fuelPlantSeed } from "./seeds";

test.use({ viewport: missionViewport });

test("lands a fuel plant and sees its ascent propellant in the next Planning Mode", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Enough left over to afford a lander on the next Turn, for its Landing Site step. Money changes no roll.
  await overrideProgramData(page, { startingMoneyMillions: 4000 });
  await page.goto(`/?seed=${fuelPlantSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  const card = page.locator(".asset-choice", {
    hasText: "Wellspring Fuel Plant",
  });
  // Its Benefit tag says what it makes over a whole Turn, and its tooltip what and where.
  const tag = card.getByTestId("benefit-tag");
  await expect(tag).toHaveText(/^Benefit \+\d+\.\d t propellant$/);
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Wellspring Fuel Plant: Makes",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "kg of ascent propellant a day at its Landing Site",
  );
  await chooseAssets(page, ["Wellspring Fuel Plant"]);
  await expect(
    page.getByRole("combobox", { name: "Activity for Wellspring Fuel Plant" }),
  ).toHaveValue("propellant-production");
  // Nothing has made any yet, so no Landing Site has propellant to show.
  await expect(page.getByTestId("ascent-propellant")).toHaveCount(0);
  await expect(page.getByTestId("landing-site-details")).not.toContainText(
    "Ascent propellant",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  await page.getByRole("button", { name: /^Skip to / }).click();
  const made = page.getByTestId("summary-ascent-propellant");
  await expect(made).toContainText(
    /Jezero Crater: Wellspring Fuel Plant made (\d+\.\d) t, so it has \1 t/,
  );
  const tonnes = /made (\d+\.\d) t/.exec((await made.textContent()) ?? "")?.[1];
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // The propellant stays at Jezero Crater, shown beside what operates there and on the Landing Site step.
  await expect(page.getByTestId("ascent-propellant")).toHaveText(
    `Ascent propellant: ${String(tonnes)} t at Jezero Crater`,
  );
  await page
    .getByTestId("ascent-propellant")
    .getByText("Ascent propellant")
    .hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "The propellant Crew need to leave the surface of Mars",
  );
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(page.getByTestId("landing-site-details")).toContainText(
    `Ascent propellant here: ${String(tonnes)} t.`,
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});
