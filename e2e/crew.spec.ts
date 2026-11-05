import { expect, test, type Page } from "@playwright/test";
import {
  endTurnAndContinue,
  endTurnWithoutLaunching,
  eventEntries,
  holdSequence,
  launchHeld,
  listenForSounds,
  overrideProgramData,
  pauseAtEvent,
  pauseAtEventAfter,
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
  // Over 5 s: two Turns of Development, a Turn played at 5x to the Crew's arrival, then two more Turns.
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

  // Too heavy for the Meridian Heavy, even with the smallest Crew and the least Supplies, so they can't be ticked
  // on it, only chosen on the Meridian Colossus and then moved.
  await launchVehicle(page).selectOption("meridian-heavy");
  await expect(crewedMission(page)).toBeDisabled();
  await launchVehicle(page).selectOption("meridian-colossus");
  await crewedMission(page).check();
  await launchVehicle(page).selectOption("meridian-heavy");
  await expect(page.getByRole("combobox", { name: "Crew size" })).toHaveValue(
    "2",
  );
  await expect(page.getByRole("combobox", { name: "Supplies" })).toHaveValue(
    "supplies-lean",
  );
  await expect(page.getByTestId("mission-mass")).toHaveText("11.5 of 8 tonnes");
  await expect(page.getByRole("alert")).toHaveText(
    "This Mission weighs 11.5 tonnes, but its Launch Vehicle can only carry 8 tonnes.",
  );
  // A larger Crew weighs and costs more, and earns more.
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("3");
  await expect(page.getByTestId("mission-mass")).toHaveText("13 of 8 tonnes");
  await expect(page.getByTestId("research-earnings")).toContainText(
    "Crew research earns 240 Science",
  );
  // The same Supplies last a larger Crew fewer days.
  await expect(
    page.getByRole("combobox", { name: "Supplies" }).getByRole("option"),
  ).toHaveText([
    "2,083 days ($100M, 2.5 t)",
    "2,500 days ($200M, 3 t)",
    "2,916 days ($300M, 3.5 t)",
  ]);
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
  await page
    .getByRole("combobox", { name: "Supplies" })
    .selectOption("supplies-ample");
  await expect(page.getByTestId("mission-mass")).toHaveText("12.5 of 8 tonnes");
  await page
    .getByRole("combobox", { name: "Supplies" })
    .selectOption("supplies-lean");
  // Protection says how much it slows radiation's harm, and adds its mass and cost.
  const protection = page.getByRole("combobox", { name: "Protection" });
  await expect(protection).toHaveValue("protection-none");
  await expect(protection.getByRole("option")).toHaveText([
    "None",
    "Light shielding, radiation −25% ($150M, 0.5 t)",
    "Heavy shielding, radiation −50% ($300M, 1 t)",
  ]);
  await protection.selectOption("protection-heavy-shielding");
  await expect(page.getByTestId("mission-mass")).toHaveText("12.5 of 8 tonnes");
  // Three Crew with the least Supplies and Heavy shielding, which keeps them alive until their Supplies run out.
  await page.getByRole("combobox", { name: "Crew size" }).selectOption("3");

  await launchVehicle(page).selectOption("meridian-colossus");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("mission-mass")).toHaveText("14 of 16 tonnes");
  // The Meridian Colossus, still unproven, the Crew, their Supplies and their Protection.
  await expect(page.getByTestId("mission-cost")).toHaveText("$4.75B");
  await expect(page.getByTestId("crew-names")).toHaveText("Health 100 each");
  await expect(page.getByTestId("crew-names")).toHaveAttribute(
    "data-detail",
    "Flying: Amara Okafor, Lena Petrova, Kenji Sato, each starting at Health 100. Radiation on the way leaves them 90 as they reach Mars (with Protection: None 79, Light shielding 85, Heavy shielding 90).",
  );
  await expect(page.getByTestId("research-earnings")).toContainText(
    "Crew research earns 240 Science",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await pauseAtEvent(
    page,
    "Crew in Mars orbit",
    () => page.getByRole("button", { name: "Launch Mission" }).click(),
    "5x",
  );
  await expect(
    eventEntries(page).filter({ hasText: "Crew in Mars orbit" }),
  ).toContainText(
    "Amara Okafor, Lena Petrova, and Kenji Sato have arrived in Mars orbit aboard the Odyssey, and start Crew research.",
  );
  await expect(
    eventEntries(page).getByRole("heading", { name: "First Crew at Mars" }),
  ).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const summary = page.getByTestId("turn-summary");
  await expect(summary.getByTestId("summary-crew")).toContainText(
    "Amara Okafor, in Mars orbit from this Turn: Health 65 of 100",
  );
  await expect(summary.getByTestId("summary-health-lost")).toContainText(
    "Amara Okafor lost 35 Health: 10 to radiation in flight, 8 to radiation at Mars, 17 to time at Mars. Protection saved 20 more",
  );
  await expect(summary.getByTestId("summary-ongoing-research")).toContainText(
    "Crew in Mars orbit, Crew research",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await summary.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("4");
  const crew = page.getByTestId("crew-at-mars").getByRole("listitem");
  // 2,500 kg, less 1.2 kg a day for the 780 days since launch.
  await expect(crew).toHaveText([
    /^Crew in Mars orbit: Amara Okafor \(Health 65\), Lena Petrova \(Health 65\), Kenji Sato \(Health 65\)\. Supplies for 1,303 days/,
  ]);
  await expect(
    page.getByRole("combobox", { name: "Activity for the Crew in Mars orbit" }),
  ).toHaveValue("crew-research");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Their Supplies last this Turn, and run out 523 days into the next, after which their Health falls quickly.
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("5");
  await expect(crew).toHaveText([
    /^Crew in Mars orbit: Amara Okafor \(Health 31\), Lena Petrova \(Health 31\), Kenji Sato \(Health 31\)\. Supplies for 523 days/,
  ]);
  await pauseAtEvent(
    page,
    "Supplies out in Mars orbit",
    () =>
      page.getByRole("button", { name: "End Turn without launching" }).click(),
    "5x",
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
    "Amara Okafor, Lena Petrova, and Kenji Sato were lost in Mars orbit, with no Supplies left.",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("lands a Crewed Mission at a Landing Site, and sees its Crew at work there in the next Planning Mode", async ({
  page,
}) => {
  // Over 5 s: two Turns of Development, then a Turn played to the landing, which takes the same real time at any speed.
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

  // It lands on 11 October 2033, and it's slowed to 1x well before then, so the Turn has time left for the landing.
  await launchHeld(page);
  await pauseAtEventAfter(page, "Crew in Jezero Crater", "1 July 2033");
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

  await page.getByRole("button", { name: "End Turn", exact: true }).click();
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
  await endTurnAndContinue(page);
  await expect(page.getByTestId("turn-number")).toHaveText("4");
  // The automatic save at the start of this Planning Mode holds the Crew.
  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("crew-at-mars")).toContainText(
    "Amara Okafor (Health 45), Lena Petrova (Health 45)",
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
