import { expect, test, type Page } from "@playwright/test";
import {
  endTurnWithoutLaunching,
  eventEntries,
  holdSequence,
  listenForSounds,
  overrideProgramData,
  pauseAtEvent,
  playToNextTurn,
  soundsHeard,
  surfaceAssets,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  colossusMoney,
  crewLandingSeed,
  crewLossSeed,
  crewSeed,
} from "./seeds";

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

  // Too heavy for the Meridian Heavy, even with the smallest Crew and the least Supplies.
  await launchVehicle(page).selectOption("meridian-heavy");
  await crewedMission(page).check();
  await expect(page.getByRole("combobox", { name: "Crew size" })).toHaveValue(
    "2",
  );
  await expect(page.getByRole("combobox", { name: "Supplies" })).toHaveValue(
    "supplies-lean",
  );
  await expect(page.getByTestId("mission-mass")).toHaveText("11 of 8 tonnes");
  await expect(page.getByRole("alert")).toHaveText(
    "This Mission weighs 11 tonnes, but its Launch Vehicle can only carry 8 tonnes.",
  );
  // A larger Crew weighs and costs more, and earns more.
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("3");
  await expect(page.getByTestId("mission-mass")).toHaveText("12.5 of 8 tonnes");
  await expect(page.getByTestId("research-earnings")).toContainText(
    "Crew research earns 240 Science",
  );
  // The same Supplies last a larger Crew fewer days.
  await expect(
    page.getByRole("combobox", { name: "Supplies" }).getByRole("option"),
  ).toHaveText([
    "666 days ($100M, 2 t)",
    "1,000 days ($150M, 3 t)",
    "1,333 days ($200M, 4 t)",
  ]);
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
  await page
    .getByRole("combobox", { name: "Supplies" })
    .selectOption("supplies-ample");
  await expect(page.getByTestId("mission-mass")).toHaveText("13 of 8 tonnes");
  await page
    .getByRole("combobox", { name: "Supplies" })
    .selectOption("supplies-lean");
  // Protection says how much it slows radiation's harm, and adds its mass and cost.
  const protection = page.getByRole("combobox", { name: "Protection" });
  await expect(protection).toHaveValue("protection-none");
  await expect(protection.getByRole("option")).toHaveText([
    "None",
    "Light shielding, radiation −25% ($150M, 1 t)",
    "Heavy shielding, radiation −50% ($300M, 2 t)",
  ]);
  await protection.selectOption("protection-heavy-shielding");
  await expect(page.getByTestId("mission-mass")).toHaveText("13 of 8 tonnes");
  await protection.selectOption("protection-none");

  await launchVehicle(page).selectOption("meridian-colossus");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("mission-mass")).toHaveText("11 of 16 tonnes");
  // The Meridian Colossus, still unproven, the Crew and their Supplies.
  await expect(page.getByTestId("mission-cost")).toHaveText("$4.2B");
  await expect(page.getByTestId("crew-names")).toHaveText("Health 100 each");
  await expect(page.getByTestId("crew-names")).toHaveAttribute(
    "data-detail",
    "Flying: Amara Okafor, Lena Petrova, each starting at Health 100. Radiation on the way leaves them 79 as they reach Mars (with Protection: None 79, Light shielding 85, Heavy shielding 90).",
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
    "Amara Okafor, in Mars orbit from this Turn: Health 57 of 100",
  );
  await expect(summary.getByTestId("summary-health-lost")).toContainText(
    "Amara Okafor lost 43 Health: 21 to radiation in flight, 11 to radiation at Mars, 11 to time at Mars",
  );
  await expect(summary.getByTestId("summary-ongoing-research")).toContainText(
    "Crew in Mars orbit, Crew research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("4");
  const crew = page.getByTestId("crew-at-mars").getByRole("listitem");
  // 2,000 kg, less 2 kg a day for the 780 days since launch.
  await expect(crew).toHaveText([
    /^Crew in Mars orbit: Amara Okafor \(Health 57\), Lena Petrova \(Health 57\)\. Supplies for 220 days/,
  ]);
  await expect(
    page.getByRole("combobox", { name: "Activity for the Crew in Mars orbit" }),
  ).toHaveValue("crew-research");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Their Supplies run out 220 days into the next Turn, after which their Health falls quickly.
  await pauseAtEvent(page, "Supplies out in Mars orbit", () =>
    page.getByRole("button", { name: "End Turn without launching" }).click(),
  );
  await expect(
    eventEntries(page).filter({ hasText: "Supplies out in Mars orbit" }),
  ).toContainText(
    "The Crew in Mars orbit have run out of Supplies, so their Health falls quickly.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(summary.getByTestId("summary-supplies-out")).toContainText(
    "Supplies ran out: Crew in Mars orbit on",
  );
  await expect(summary.getByTestId("summary-crew-lost")).toContainText(
    "Amara Okafor and Lena Petrova were lost in Mars orbit, with no Supplies left.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("lands a Crewed Mission at a Landing Site, and sees its Crew at work there in the next Planning Mode", async ({
  page,
}) => {
  // Over 5 s: two Turns of Development, then a Turn played at 10x.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await page.goto(`/?seed=${crewLandingSeed}`);
  await page
    .getByTestId("development")
    .filter({ hasText: "Meridian Colossus" })
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  await endTurnWithoutLaunching(page);
  await endTurnWithoutLaunching(page);

  await launchVehicle(page).selectOption("meridian-colossus");
  await crewedMission(page).check();
  await expect(page.getByTestId("landing-site-details")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Crew destination" })
    .selectOption("landingSite");
  // Landing brings the Landing Site choice and entry/descent/landing, at the site's risk.
  await expect(
    page.getByRole("combobox", { name: "Landing Site" }),
  ).toHaveValue("jezero-crater");
  await expect(page.getByTestId("landing-site-details")).toContainText(
    "The first landing here earns 120 Science.",
  );
  await expect(
    page.getByRole("combobox", {
      name: "Reliability for Entry/descent/landing",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Activity for the Crew", exact: true }),
  ).toHaveValue("crew-field-research");
  await page
    .getByRole("combobox", { name: "Protection" })
    .selectOption("protection-light-shielding");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(page, "Crew in Jezero Crater", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  await expect(
    eventEntries(page).filter({ hasText: "Crew in Jezero Crater" }),
  ).toContainText(
    "Amara Okafor and Lena Petrova have landed in Jezero Crater aboard the Odyssey, and start Field research.",
  );
  await expect(
    eventEntries(page).getByRole("heading", {
      name: "First Crew on the surface",
    }),
  ).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Mission Mode has moved to the surface for a Crew landing of its own, with the Crew aboard until it touches down.
  const scene = page.getByTestId("mission-scene");
  await expect(page.getByTestId("current-view")).toHaveText("Surface");
  await expect(scene).toHaveAttribute("data-sequence", "crew-landing");
  await expect(scene).toHaveAttribute("data-crew-outside", "0");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Crew landing: Odyssey",
  );
  const landed = holdSequence(page);
  await page.getByRole("button", { name: "1x" }).click();
  await landed;
  await expect(scene).not.toHaveAttribute("data-sequence");
  // Then they're out at work.
  await expect(scene).toHaveAttribute("data-crew-outside", "2");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Crew (Odyssey): Amara Okafor, Lena Petrova: Field research",
  );
  await expect(surfaceAssets(page)).toHaveText(["Odyssey"]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-ongoing-research")).toContainText(
    "Crew in Jezero Crater, Field research",
  );
  // Their Light shielding slowed radiation in flight and at Mars.
  await expect(summary.getByTestId("summary-health-lost")).toContainText(
    /Amara Okafor lost \d+ Health: .*\. Protection saved \d+ more/,
  );
  await summary.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("4");
  await expect(
    page.getByTestId("crew-at-mars").getByRole("listitem"),
  ).toHaveText([
    /Crew in Jezero Crater: Amara Okafor \(Health \d+\), Lena Petrova \(Health \d+\)/,
  ]);
  await expect(
    page.getByRole("combobox", {
      name: "Activity for the Crew in Jezero Crater",
    }),
  ).toHaveValue("crew-field-research");
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
    "Amara Okafor (Health 57), Lena Petrova (Health 57)",
  );
});

test("loses the Crew in a failed launch, and sees the drop in Public Support in the Turn summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await listenForSounds(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await page.goto(`/?seed=${crewLossSeed}`);
  await page
    .getByTestId("development")
    .filter({ hasText: "Meridian Colossus" })
    .getByRole("checkbox", { name: "Start Development" })
    .check();
  await endTurnWithoutLaunching(page);
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("public-support")).toHaveText("72");
  await launchVehicle(page).selectOption("meridian-colossus");
  await crewedMission(page).check();

  await pauseAtEvent(page, "Crew lost", () =>
    page.getByRole("button", { name: "Launch Mission" }).click(),
  );
  const lost = eventEntries(page).filter({ hasText: "Crew lost" });
  // Losing two Crew costs more than the 52 Public Support left after the failed launch, so it takes all of it.
  await expect(lost).toContainText(
    "Amara Okafor and Lena Petrova were lost when Launch failed. Losing Crew costs 52 Public Support.",
  );
  await expect(lost).toHaveClass(/failed/);
  // Losing Crew has a sound of its own, after the failure's.
  expect((await soundsHeard(page)).map(([file]) => file)).toEqual([
    "failure.wav",
    "crew-lost.wav",
  ]);
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "10x" }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-crew-lost")).toContainText(
    "Amara Okafor and Lena Petrova were lost when Launch failed. Public Support lost: 52",
  );
  await expect(summary.getByTestId("summary-failure")).toContainText(
    "Public Support lost: 20",
  );
  await expect(summary.getByTestId("summary-public-support")).toHaveText(
    "72 to 0",
  );
  await expect(summary.getByRole("alert")).toContainText(
    "The Program has been cancelled.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});
