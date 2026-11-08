import { expect, test, type Page } from "@playwright/test";
import {
  ascentSeed,
  colossusMoney,
  fuelPlantColossusMoney,
  roundTripLandedSave,
  roundTripSeed,
  roundTripThereSave,
} from "./colossusSeeds";
import {
  continueFromSave,
  eventEntries,
  holdSceneAt,
  holdSequence,
  listenForSounds,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  playFastUntil,
  soundsHeard,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import {
  sampleAscentFailureSeed,
  sampleReturnMoney,
  samplesReadySave,
} from "./sampleSeeds";

test.use({ viewport: missionViewport });

/** Where the camera is at the rendezvous in Mars orbit, as the scene reports it. */
const marsRendezvousCamera = "11.500 2.200 -8.000";

function scene(page: Page) {
  return page.getByTestId("mission-scene");
}

function currentView(page: Page) {
  return page.getByTestId("current-view");
}

/** The picture the events column shows for the entry with this title. */
function pictureOf(page: Page, title: string) {
  return eventEntries(page)
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByTestId("event-picture");
}

/** Brings home whatever Planning Mode offers to bring home, and sets the Turn going with nothing launched. */
function endTurnWithoutLaunching(page: Page) {
  return page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
}

test("plays round-trip Crew's Mars ascent at their Landing Site, then moves to the spacecraft view for the rendezvous in Mars orbit", async ({
  page,
}) => {
  // Over 5 s: the ascent and the rendezvous each play for some seconds of real time.
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: fuelPlantColossusMoney,
  });
  await continueFromSave(page, roundTripLandedSave(ascentSeed));
  await page
    .getByRole("checkbox", { name: "Bring Amara Okafor and Lena Petrova home" })
    .check();

  // The Crew's cabin lifts off their lander, which stays standing.
  const lifting = holdSequence(page, 1500);
  await endTurnWithoutLaunching(page);
  await lifting;
  await expect(currentView(page)).toHaveText("Surface");
  await expect(scene(page)).toHaveAttribute("data-sequence", "crew-ascent");
  await expect(page.getByTestId("surface-site")).toHaveText("Jezero Crater");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Crew Mars ascent: ",
  );
  await expect(page.getByTestId("surface-ascent")).toBeVisible();
  await expect(pictureOf(page, "Mars ascent")).toHaveAttribute(
    "data-picture",
    "marsAscent",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Once it has played, Mission Mode moves to the spacecraft view as their cabin climbs to dock with their stage.
  const docking = holdSceneAt(page, "marsRendezvous", "closing");
  await page.getByRole("button", { name: "1x" }).click();
  await docking;
  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(scene(page).locator("canvas")).toHaveAttribute(
    "data-camera-position",
    marsRendezvousCamera,
  );
  await expect(page.getByTestId("spacecraft-asset")).toHaveText([
    "Earth return stage",
    "Crew",
  ]);
  await expect(page.getByTestId("spacecraft-status")).toHaveText(
    "Mars orbit rendezvous: the Crew coming up to dock with the Earth return stage",
  );
  await expect(pictureOf(page, "Mars orbit rendezvous")).toHaveAttribute(
    "data-picture",
    "marsOrbitRendezvous",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("plays the samples' failed Mars ascent as a crash at their Landing Site, which the view stays on", async ({
  page,
}) => {
  // Over 5 s: the crash plays for some seconds of real time.
  const problems = watchForProblems(page);
  await overrideProgramData(page, { startingMoneyMillions: sampleReturnMoney });
  await continueFromSave(page, samplesReadySave(sampleAscentFailureSeed));
  await page
    .getByRole("checkbox", { name: "Send the samples at Jezero Crater home" })
    .check();

  const lifting = holdSequence(page, 1000);
  await endTurnWithoutLaunching(page);
  await lifting;
  await expect(currentView(page)).toHaveText("Surface");
  await expect(scene(page)).toHaveAttribute("data-sequence", "ascent-crash");
  await expect(page.getByTestId("surface-status")).toContainText(
    "Mars ascent failed: Kestrel Lifter",
  );
  await expect(page.getByTestId("surface-ascent")).toHaveText("Kestrel Lifter");

  // Its engine cuts out, and it falls back and crashes beside its platform.
  const crashed = holdSequence(page, 4500);
  await page.getByRole("button", { name: "1x" }).click();
  await crashed;
  await expect(page.getByTestId("surface-ascent")).toHaveText(
    "Kestrel Lifter: crashed",
  );
  await expect(currentView(page)).toHaveText("Surface");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("shows round-trip Crew heading home from Mars orbit in the solar system, then their Earth entry and splashdown in the spacecraft view", async ({
  page,
}) => {
  // Over 5 s: Earth entry plays for some seconds of real time.
  const problems = watchForProblems(page);
  await listenForSounds(page);
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, roundTripThereSave(roundTripSeed));
  await page.getByRole("checkbox", { name: /^Bring .+ home$/ }).check();

  // They leave Mars orbit for home, which the solar system view shows.
  await pauseAtEvent(page, "Trans-Earth injection", () =>
    endTurnWithoutLaunching(page),
  );
  await expect(currentView(page)).toHaveText("Solar system");
  await expect(page.getByTestId("homeward-spacecraft")).toHaveText(
    "Earth return stage: Crew heading home",
  );
  await expect(pictureOf(page, "Trans-Earth injection")).toHaveAttribute(
    "data-picture",
    "transEarthInjection",
  );

  // At Earth, Mission Mode moves to the spacecraft view for Earth entry, ending in a splashdown. Earth entry is on 24
  // January 2036, and the Turn is slowed to 1x well before then, so there is time left in it for the whole sequence.
  const parachutes = holdSceneAt(page, "earthEntry", "descending");
  await playFastUntil(page, "24 October 2035");
  await parachutes;
  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(page.getByTestId("spacecraft-status")).toHaveText(
    "Earth entry: the capsule is coming down under its parachutes",
  );
  await expect(pictureOf(page, "Earth entry")).toHaveAttribute(
    "data-picture",
    "earthEntry",
  );
  await expect(pictureOf(page, "Crew home")).toHaveAttribute(
    "data-picture",
    "crewHome",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  const splash = holdSceneAt(page, "earthEntry", "splashedDown");
  await page.getByRole("button", { name: "1x" }).click();
  await splash;
  await expect(page.getByTestId("spacecraft-status")).toHaveText(
    "Earth entry: the capsule has splashed down in the ocean",
  );

  // Once it has played, the view goes back to the solar system.
  const over = holdSceneAt(page, "earthEntry", null);
  await page.getByRole("button", { name: "1x" }).click();
  await over;
  await expect(currentView(page)).toHaveText("Solar system");
  // Crew home safe play a sound of their own as they come home.
  const heard = await soundsHeard(page);
  expect(
    heard.some(
      ([file, column]) =>
        file === "crew-home.wav" && column?.includes("Crew home") === true,
    ),
  ).toBe(true);
  expect(problems).toEqual([]);
});
