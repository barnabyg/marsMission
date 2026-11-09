import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  endTurnAndContinue,
  missionViewport,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { successSeed } from "./seeds";

function launchMission(page: Page) {
  return page.getByRole("button", { name: "Launch Mission" });
}

/** Planning Mode with no Asset ticked: Launch Mission waits for one, with a hint rather than an error. */
async function expectNothingTicked(page: Page) {
  for (const box of await page
    .locator(".asset-choice")
    .getByRole("checkbox")
    .all()) {
    await expect(box).not.toBeChecked();
  }
  await expect(page.getByTestId("nothing-ticked")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(launchMission(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "End Turn without launching" }),
  ).toBeEnabled();
}

test("starts each Turn's New Mission with nothing ticked, and tags an Asset already at Mars", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expectNothingTicked(page);
  await expect(page.getByTestId("operating-tag")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("nothing-ticked")).toHaveCount(0);
  await launchMission(page).click();
  await endTurnAndContinue(page);

  // The orbiter at Mars keeps working, so the New Mission doesn't start with another ticked.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  await expectNothingTicked(page);
  const atMars = page
    .locator(".asset-choice", { hasText: "Pathfinder Orbiter" })
    .getByTestId("operating-tag");
  await expect(atMars).toHaveText("1 at Mars");
  await expect(page.getByTestId("operating-tag")).toHaveCount(1);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await atMars.hover();
  await expect(page.getByTestId("tooltip-detail")).toHaveText(
    "Pathfinder Orbiter operating at Mars: 1. Each keeps working without being launched again, so ticking this launches another.",
  );
  expect(problems).toEqual([]);
});

test("plans a Mission in four numbered steps, opening Landing Site and Mission Events once they apply", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  const steps = page.getByTestId("mission-step");
  await expect(steps.getByRole("heading")).toHaveText([
    "1Launch Vehicle and Trajectory",
    "2Assets and Crew",
    "3Landing Site",
    "4Mission Events, Reliability and Contingency",
  ]);
  const landingSite = page.getByRole("region", { name: "3 Landing Site" });
  const events = page.getByRole("region", { name: /^4 Mission Events/ });

  // With nothing ticked, neither applies yet, and each says why.
  await expect(landingSite.getByTestId("mission-step-collapsed")).toHaveText(
    "Opens when the Mission carries a lander, a rover or Crew who land.",
  );
  await expect(landingSite.getByRole("combobox")).toHaveCount(0);
  await expect(events.getByTestId("mission-step-collapsed")).toBeVisible();
  await expect(page.getByTestId("mission-event")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // An orbiter goes through Mission Events but doesn't land.
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(events.getByTestId("mission-step-collapsed")).toHaveCount(0);
  await expect(page.getByTestId("mission-event").first()).toBeVisible();
  await expect(landingSite.getByTestId("mission-step-collapsed")).toBeVisible();

  // A lander opens the Landing Site.
  await chooseAssets(page, ["Prospector Lander"]);
  await expect(landingSite.getByTestId("mission-step-collapsed")).toHaveCount(
    0,
  );
  await expect(landingSite.getByRole("combobox")).toBeVisible();
  await expect(page.getByTestId("landing-site-details")).toBeVisible();
  // Crew who land open it too, which crew.spec.ts covers, as no Launch Vehicle a new Program has can carry them.
  expect(problems).toEqual([]);
});

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

test("lists the planned Mission's Mission Events with rough risk bands, which change with what it carries", async ({
  page,
}) => {
  await page.route("**/data/assets.json", async (route) => {
    const response = await route.fetch();
    const assets = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: [
        ...assets,
        {
          id: "test-probe",
          name: "Flyby Probe",
          kind: "orbiter",
          description: "A small probe that flies past Mars.",
          costMillions: 100,
          massTonnes: 1,
          serviceLifeOptions: [{ days: 900, costMillions: 0 }],
          failureChancePerTurn: 0,
          missionEvents: [],
          technologyReadiness: "flight-proven",
          activities: ["nothing"],
        },
      ],
    });
  });
  await page.goto("/");
  await chooseAssets(page, ["Pathfinder Orbiter"]);

  const events = page.getByTestId("mission-event");
  await expect(events).toHaveCount(3);
  await expect(events.nth(0)).toContainText("Launch");
  await expect(events.nth(1)).toContainText("Mars transfer burn");
  await expect(events.nth(2)).toContainText("Mars orbit insertion");
  for (const band of await page.getByTestId("risk-band").allTextContents()) {
    expect(band).toMatch(/^(~\d+%|Over \d+%)$/);
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Flyby Probe"]);
  await expect(events).toHaveCount(2);
  await expect(page.getByTestId("mission-events")).not.toContainText(
    "Mars orbit insertion",
  );
});

test("buys Reliability, sees the risk band and cost change, and launches", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);

  const insertion = page
    .getByTestId("mission-event")
    .filter({ hasText: "Mars orbit insertion" });
  const band = insertion.getByTestId("risk-band");
  const bandBefore = await band.textContent();
  const costBefore = await page.getByTestId("mission-cost").textContent();
  await expect(insertion.getByRole("combobox")).toHaveValue("none");

  await insertion.getByRole("combobox").selectOption("redundant");
  await expect(band).not.toHaveText(bandBefore ?? "");
  await expect(page.getByTestId("mission-cost")).not.toHaveText(
    costBefore ?? "",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  await endTurnAndContinue(page);

  // Reliability applied to that Mission only.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(page.getByTestId("mission-cost")).toHaveText(costBefore ?? "");
  await expect(insertion.getByRole("combobox")).toHaveValue("none");
  expect(problems).toEqual([]);
});

test.describe("at 1920×1080", () => {
  test.use({ viewport: missionViewport });

  test("shows quiet Asset cards on Turn 1, which keep their height as others are ticked", async ({
    page,
  }) => {
    await page.goto(`/?seed=${successSeed}`);
    const cards = page.locator(".asset-choice");
    await expect(cards.first()).toBeVisible();
    // Flight-proven is the usual case, and a Benefit that would add nothing says nothing, so neither is tagged.
    await expect(page.getByTestId("technology-readiness")).not.toHaveText([
      /Flight-proven/,
    ]);
    for (const tag of await page.getByTestId("benefit-tag").allTextContents()) {
      expect(tag).not.toMatch(/\+0 |\+\$0M/);
    }
    const heights = async () =>
      Promise.all(
        (await cards.all()).map(
          async (card) => (await card.boundingBox())?.height,
        ),
      );
    const before = await heights();
    await chooseAssets(page, ["Pathfinder Orbiter"]);
    await expect(page.getByTestId("chosen-asset")).toHaveCount(1);
    expect(await heights()).toEqual(before);
    await chooseAssets(page, []);
    expect(await heights()).toEqual(before);
  });
});
