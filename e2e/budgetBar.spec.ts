import { expect, test } from "@playwright/test";
import {
  chooseAssets,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

test("shows a Mission within its limits on the budget bar, ready to launch", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);

  const cost = page.getByTestId("cost-gauge");
  const mass = page.getByTestId("mass-gauge");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(cost).toContainText("of $2.3B");
  await expect(cost).toHaveAttribute("data-level", "within");
  await expect(page.getByTestId("mission-mass")).toHaveText("2.5 of 4 tonnes");
  await expect(mass).toHaveAttribute("data-level", "within");
  await expect(
    page.getByRole("meter", {
      name: "Mission mass against Launch Vehicle capacity",
    }),
  ).toHaveAttribute("aria-valuenow", "2.5");
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toBeEnabled();
  await expect(launch).not.toHaveAttribute("title");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("turns the mass bar red and disables Launch Mission, saying why, when an Asset takes the Mission over capacity", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  // Ticked on the Meridian Heavy, as neither can be ticked once it wouldn't fit, then moved to a smaller one.
  const vehicle = page.getByRole("combobox", { name: "Launch Vehicle" });
  await vehicle.selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter", "Prospector Lander"]);
  await vehicle.selectOption("meridian-medium");

  const mass = page.getByTestId("mass-gauge");
  await expect(page.getByTestId("mission-mass")).toHaveText("5.5 of 4 tonnes");
  await expect(mass).toHaveAttribute("data-level", "over");
  await expect(mass.locator(".gauge-fill")).toHaveCSS(
    "background-color",
    "rgb(255, 143, 122)",
  );
  await expect(page.getByTestId("cost-gauge")).toHaveAttribute(
    "data-level",
    "within",
  );
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toBeDisabled();
  await expect(launch).toHaveAttribute(
    "title",
    "This Mission weighs 5.5 tonnes, but its Launch Vehicle can only carry 4 tonnes.",
  );

  // The budget bar stays in view however far the steps are scrolled.
  const bar = page.getByTestId("budget-bar");
  for (const top of [100_000, 0]) {
    await page.getByTestId("mission-steps").evaluate((steps, to) => {
      steps.scrollTop = to;
    }, top);
    await expect(bar).toBeInViewport({ ratio: 1 });
  }

  // A larger Launch Vehicle brings it back within its limits.
  await vehicle.selectOption("meridian-heavy");
  await expect(mass).not.toHaveAttribute("data-level", "over");
  await expect(launch).toBeEnabled();
  expect(problems).toEqual([]);
});

test("greys out Launch Mission with nothing ticked, saying why", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toBeDisabled();
  await expect(launch).toHaveAttribute(
    "title",
    "A Mission must carry at least one Asset or Crew.",
  );
  // A neutral grey, with none of the accent colour of an enabled Launch Mission.
  await expect(launch).toHaveCSS("background-color", "rgb(43, 47, 58)");
  await expect(launch).toHaveCSS("opacity", "1");
});

test("shows why a plan the player can't afford is rejected", async ({
  page,
}) => {
  await overrideProgramData(page, { startingMoneyMillions: 1100 });
  await page.goto("/");
  // Affordable when ticked, until a dearer Launch Vehicle takes it over the Money.
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");

  await expect(page.getByRole("alert")).toContainText("costs $1.4B");
  await expect(page.getByRole("alert")).toContainText("$1.1B");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeDisabled();
});
