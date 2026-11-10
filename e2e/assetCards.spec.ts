import { expect, test } from "@playwright/test";
import { termsWithoutTooltips, watchForProblems } from "./helpers";
import { openLaunchStep, chooseAssets } from "./planningHelpers";
import { successSeed } from "./seeds";

// The New Mission's Asset cards: what each shows, which wouldn't fit, the choices of a ticked Asset, and its details.

test("shows each Asset as a card, greys out those that wouldn't fit, and reveals an Asset's choices once ticked", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const card = (name: string) =>
    page.locator(".asset-choice", { hasText: name });

  const orbiter = card("Pathfinder Orbiter");
  await expect(orbiter.getByTestId("asset-cost")).toHaveText("$700M");
  await expect(orbiter.getByTestId("asset-mass")).toHaveText("2.5 t");
  // Flight-proven is the usual case, so only the other two readiness levels are a pill on a card.
  await expect(orbiter.getByTestId("technology-readiness")).toHaveCount(0);
  await expect(orbiter).not.toContainText("Flight-proven");
  await expect(
    card("Pinpoint Lander").getByTestId("technology-readiness"),
  ).toHaveText("Unproven");
  const rover = card("Endurance Rover");
  await expect(rover.getByTestId("technology-readiness")).toHaveText(
    "Needs Development",
  );
  // It can't be ticked until its Development has finished, so it is greyed out, saying why on hovering.
  await expect(rover.getByRole("checkbox")).toBeDisabled();
  await expect(rover).toHaveClass(/unavailable/);
  await expect(rover).toHaveAttribute(
    "title",
    "Needs Development before it can fly.",
  );
  await expect(page.getByTestId("crew-facts")).toContainText("from $3B");

  // Nothing ticked: on the Meridian Medium, which carries 4 tonnes, every Asset fits alone.
  await expect(orbiter).not.toHaveClass(/unavailable/);
  await expect(orbiter.getByTestId("unavailable-reason")).toHaveCount(0);
  await expect(orbiter.getByRole("combobox")).toHaveCount(0);

  // Ticked, its choices are in the list under the cards, so the card itself keeps its height.
  const heightBefore = (await orbiter.boundingBox())?.height;
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const chosen = page
    .getByTestId("chosen-asset")
    .filter({ hasText: "Pathfinder Orbiter" });
  await expect(
    chosen.getByRole("combobox", { name: "Activity for Pathfinder Orbiter" }),
  ).toBeVisible();
  await expect(
    chosen.getByRole("combobox", {
      name: "Service Life for Pathfinder Orbiter",
    }),
  ).toBeVisible();
  await expect(orbiter.getByRole("combobox")).toHaveCount(0);
  expect((await orbiter.boundingBox())?.height).toBe(heightBefore);
  // Its Reliability in service is with the Mission Events', so every Reliability choice is in one step.
  await expect(
    chosen.getByRole("combobox", { name: /Reliability/ }),
  ).toHaveCount(0);
  const inService = page.getByTestId("asset-in-service");
  await expect(inService).toHaveCount(1);
  await expect(inService).toContainText("Pathfinder Orbiter");
  await expect(
    inService.getByRole("combobox", {
      name: "Reliability for Pathfinder Orbiter in service",
    }),
  ).toBeVisible();
  // With the orbiter's 2.5 tonnes aboard, a 3-tonne lander would be too heavy, but is within the Money, so it can't
  // be ticked. It is greyed out, with the reason on hovering and for a screen reader, and no warning on the card.
  const lander = card("Prospector Lander");
  await expect(lander).toHaveClass(/unavailable/);
  await expect(lander).toHaveAttribute(
    "title",
    "Too heavy for the Launch Vehicle.",
  );
  await expect(lander.getByRole("checkbox")).toBeDisabled();
  await expect(lander.getByRole("checkbox")).toHaveAccessibleDescription(
    "Too heavy for the Launch Vehicle.",
  );
  await expect(page.getByTestId("crew-facts")).toBeVisible();
  const crew = page.locator(".crew-choice");
  await expect(crew).toHaveClass(/unavailable/);
  await expect(crew).toHaveAttribute(
    "title",
    "Too heavy for the Launch Vehicle · Costs more than the Money left.",
  );
  await expect(
    page.getByRole("checkbox", { name: /Crewed Mission/ }),
  ).toBeDisabled();
  // Something ticked can always be unticked, even once a smaller choice leaves it too heavy.
  await openLaunchStep(page);
  await page.getByRole("combobox", { name: "Trajectory" }).selectOption("fast");
  await expect(orbiter.getByRole("checkbox")).toBeEnabled();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, []);
  await expect(page.getByTestId("chosen-assets")).toHaveCount(0);
  await expect(lander).not.toHaveClass(/unavailable/);
  await expect(lander).not.toHaveAttribute("title");
  await expect(lander.getByRole("checkbox")).toBeEnabled();
  expect(problems).toEqual([]);
});

test("opens an Asset's details from its card, and closes them without changing the plan", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const card = (name: string) =>
    page.locator(".asset-choice", { hasText: name });
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const orbiter = card("Pathfinder Orbiter");
  const activity = page.getByRole("combobox", {
    name: "Activity for Pathfinder Orbiter",
  });
  await activity.selectOption("orbital-research");
  const spend = await page.getByTestId("budget-bar").textContent();

  // From the keyboard, on an Asset that isn't ticked.
  const about = card("Prospector Lander").getByRole("button", {
    name: "About Prospector Lander",
  });
  await about.focus();
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog", { name: "Prospector Lander" });
  await expect(details).toBeVisible();
  await expect(details).toContainText("A stationary lander");
  for (const [fact, value] of [
    ["Cost", "$800M"],
    ["Mass", "3 t"],
    ["Upkeep", "$10M per Turn"],
    ["Technology Readiness", "Flight-proven"],
    ["Lands", "At a Landing Site"],
    ["Service Life", "1300 days ($0M) or 2100 days ($100M)"],
  ]) {
    await expect(details.getByTestId(`detail-${fact}`)).toHaveText(
      `${fact}${value}`,
    );
  }
  await expect(details.getByTestId("detail-Reliability")).toContainText(
    "None: ~10% per Turn",
  );
  await expect(details.getByTestId("detail-Activities")).toContainText(
    "Surface research: Studies the rocks and weather",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(about).toBeFocused();

  // An Asset that can't be ticked yet can still be read about, and its Benefit is there in words.
  await card("Endurance Rover")
    .getByRole("button", { name: "About Endurance Rover" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Endurance Rover" }),
  ).toContainText("Needs Development");
  await page.getByRole("button", { name: "Close" }).click();
  await card("Courier Relay")
    .getByRole("button", { name: "About Courier Relay" })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Courier Relay" })
      .getByTestId("detail-Benefit"),
  ).toContainText("Raises the Ongoing Research");
  await page.getByRole("button", { name: "Close" }).click();

  // The plan is as it was.
  await expect(orbiter.getByRole("checkbox")).toBeChecked();
  await expect(
    card("Prospector Lander").getByRole("checkbox"),
  ).not.toBeChecked();
  await expect(activity).toHaveValue("orbital-research");
  await expect(page.getByTestId("budget-bar")).toHaveText(spend ?? "");
  expect(problems).toEqual([]);
});
