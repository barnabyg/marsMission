import { expect, test, type Locator, type Page } from "@playwright/test";
import { tooltips, type Term } from "../src/ui/tooltips";
import {
  chooseAssets,
  playToNextTurn,
  termsInButtons,
  termsWithoutTooltips,
} from "./helpers";
import { landingSeed, successSeed } from "./seeds";

test("explains a game term on hover and on keyboard focus", async ({
  page,
}) => {
  await page.goto("/");

  const term = page.locator("dt [data-term='Public Support']");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveCount(0);

  await term.hover();
  await expect(tooltip).toContainText(tooltips["Public Support"]);

  await page.getByRole("heading", { name: "Mission", exact: true }).hover();
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await term.focus();
  await expect(tooltip).toContainText(tooltips["Public Support"]);
  await term.blur();
  await expect(tooltip).toHaveCount(0);
});

async function expectTooltip(page: Page, term: Locator, name: Term) {
  await term.hover();
  await expect(page.getByRole("tooltip")).toContainText(tooltips[name]);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

test("explains the terms of Doing Science in Planning Mode and on the surface panel", async ({
  page,
}) => {
  await page.goto(`/?seed=${landingSeed}`);
  await expect(page.getByLabel("Activity for Pathfinder Orbiter")).toHaveValue(
    "survey",
  );
  await expectTooltip(
    page,
    page.getByLabel("Activity for Pathfinder Orbiter"),
    "Survey",
  );
  await expectTooltip(
    page,
    page.locator(".asset-choice [data-term='Activity']").first(),
    "Activity",
  );
  await expectTooltip(
    page,
    page
      .getByTestId("research-earnings")
      .locator("[data-term='Ongoing Research']"),
    "Ongoing Research",
  );

  await chooseAssets(page, ["Trailblazer Rover"]);
  await expectTooltip(
    page,
    page
      .getByTestId("research-earnings")
      .locator("[data-term='Research Grant']"),
    "Research Grant",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await page.getByRole("button", { name: "Surface" }).click();
  await expect(page.getByTestId("surface-site")).toBeVisible();
  await expectTooltip(
    page,
    page.locator("h2 [data-term='Landing Site']"),
    "Landing Site",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(await termsInButtons(page)).toEqual([]);
});

test("the tooltip check ignores buttons but still catches a term anywhere else", async ({
  page,
}) => {
  await page.goto("/");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      "<button>Save this Program</button>",
    );
  });
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", "<p>Save this Program</p>");
  });
  expect(await termsWithoutTooltips(page)).toEqual(["Program"]);
});

test("no button highlights a game term, while the text around it keeps its tooltips", async ({
  page,
}) => {
  // Over 5 s: goes through most screens, which includes playing a whole Turn and reloading.
  await page.goto(`/?seed=${successSeed}`);
  expect(await termsInButtons(page)).toEqual([]);

  const launch = page.getByRole("button", { name: "Launch Mission" });
  await launch.hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("h2 [data-term='Mission']").hover();
  await expect(page.getByRole("tooltip")).toContainText(tooltips.Mission);
  await page.mouse.move(0, 0);

  await page.getByRole("button", { name: "Retire Program" }).click();
  expect(await termsInButtons(page)).toEqual([]);
  await expect(page.locator("p [data-term='Program']")).toBeVisible();
  await page.getByRole("button", { name: "Keep going" }).click();

  await launch.click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  expect(await termsInButtons(page)).toEqual([]);
  await playToNextTurn(page);
  expect(await termsInButtons(page)).toEqual([]);

  await page.reload();
  await expect(page.getByTestId("opening-screen")).toBeVisible();
  expect(await termsInButtons(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await page.getByRole("button", { name: "Retire Program" }).click();
  await page.getByRole("button", { name: "Yes, retire the Program" }).click();
  await expect(page.getByTestId("program-summary")).toBeVisible();
  expect(await termsInButtons(page)).toEqual([]);
});
