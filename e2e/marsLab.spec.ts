import { expect, test, type Page } from "@playwright/test";
import {
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { overrideProgramData } from "./saveHelpers";
import { openLaunchStep, chooseAssets } from "./planningHelpers";
import { labSeed } from "./seeds";

test.use({ viewport: missionViewport });

/** Lands this Asset alone at Jezero Crater on the Meridian Medium, as the seed search plays it, and ends the Turn. */
async function landAtJezero(page: Page, name: string): Promise<void> {
  // Once something is ticked, the Launch Vehicle step has folded, so Change opens it first.
  await openLaunchStep(page);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-medium");
  await chooseAssets(page, [name]);
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: /^Skip to / }).click();
}

test("lands a Mars lab beside a rover and sees the Research Grant it raised in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  // Enough for the rover and then the lab, which starts unproven. Money changes no roll.
  await overrideProgramData(page, { startingMoneyMillions: 4000 });
  await page.goto(`/?seed=${String(labSeed)}`);

  // With nothing on the surface yet, the lab would add nothing: it has no "+$0M" tag, and its details say why.
  const lab = page.locator(".asset-choice", { hasText: "Curie Station" });
  const tag = lab.getByTestId("benefit-tag");
  await expect(lab.getByTestId("asset-mass")).toBeVisible();
  await expect(tag).toHaveCount(0);
  await lab.getByRole("button", { name: "About Curie Station" }).click();
  const benefitDetail = page
    .getByRole("dialog", { name: "Curie Station" })
    .getByTestId("detail-Benefit");
  await expect(benefitDetail).toContainText(
    "Raises the Research Grants of the rovers and Crew at its Landing Site",
  );
  await expect(benefitDetail).toContainText(
    "It adds nothing this Turn, as nothing it raises at a Landing Site is earning a Research Grant.",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await landAtJezero(page, "Trailblazer Rover");
  await page
    .getByTestId("turn-summary")
    .getByRole("button", { name: "Continue" })
    .click();

  // With the rover earning Research Grants at Jezero Crater, the tag shows the money the lab would add there.
  await expect(tag).toHaveText(/^Benefit \+\$[1-9][\d.]*[MB]$/);
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    /Landed at Jezero Crater this Turn, it would raise the Research Grants of the 1 Asset there, adding about \$[\d.]+[MB] over a whole Turn\./,
  );
  await chooseAssets(page, ["Curie Station"]);
  await expect(
    page.getByRole("combobox", { name: "Activity for Curie Station" }),
  ).toHaveValue("sample-analysis");
  await landAtJezero(page, "Curie Station");

  const grants = page
    .getByTestId("turn-summary")
    .getByTestId("summary-research-grants");
  await expect(grants).toContainText(
    /Trailblazer Rover: \$[\d.]+[MB], raised on \d+ days by the Benefit from Curie Station, which added \$[1-9][\d.]*[MB]/,
  );
  await grants.getByText("Benefit", { exact: true }).first().hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "a Mars lab raising the Research Grants of the rovers and Crew at its Landing Site",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});
