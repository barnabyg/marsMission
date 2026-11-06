import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  missionViewport,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { labSeed } from "./seeds";

test.use({ viewport: missionViewport });

/** Lands this Asset alone at Jezero Crater on the Meridian Medium, as the seed search plays it, and ends the Turn. */
async function landAtJezero(page: Page, name: string): Promise<void> {
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-medium");
  await chooseAssets(page, [name]);
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
}

test("lands a Mars lab beside a rover and sees the Research Grant it raised in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Enough for the rover and then the lab, which starts unproven. Money changes no roll.
  await overrideProgramData(page, { startingMoneyMillions: 4000 });
  await page.goto(`/?seed=${String(labSeed)}`);

  // With nothing on the surface yet, the lab's Benefit tag says it would add nothing, and why.
  const lab = page.locator(".asset-choice", { hasText: "Curie Station" });
  const tag = lab.getByTestId("benefit-tag");
  await expect(tag).toHaveText("Benefit +$0M");
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Curie Station: Raises the Research Grants of the rovers and Crew at its Landing Site",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "It adds nothing this Turn, as nothing it raises at a Landing Site is earning a Research Grant.",
  );
  await landAtJezero(page, "Trailblazer Rover");
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  // With the rover earning Research Grants at Jezero Crater, the tag shows the money the lab would add there.
  await expect(tag).toHaveText(/^Benefit \+\$[1-9]\d*M$/);
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    /Landed at Jezero Crater this Turn, it would raise the Research Grants of the 1 Asset there, adding about \$\d+M over a whole Turn\./,
  );
  await chooseAssets(page, ["Curie Station"]);
  await expect(
    lab.getByRole("combobox", { name: "Activity for Curie Station" }),
  ).toHaveValue("sample-analysis");
  await landAtJezero(page, "Curie Station");

  const grants = page
    .getByTestId("turn-summary")
    .getByTestId("summary-research-grants");
  await expect(grants).toContainText(
    /Trailblazer Rover: \$\d+M, raised on \d+ days by the Benefit from Curie Station, which added \$[1-9]\d*M/,
  );
  await grants.getByText("Benefit", { exact: true }).first().hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "a Mars lab raising the Research Grants of the rovers and Crew at its Landing Site",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});
