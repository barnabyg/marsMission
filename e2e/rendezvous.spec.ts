import { expect, test, type Page } from "@playwright/test";
import {
  chooseAssets,
  continueFromSave,
  launchHeld,
  missionViewport,
  overrideProgramData,
  pauseAtEvent,
  termsWithoutTooltips,
  viewButton,
  watchForProblems,
} from "./helpers";
import {
  colossusBuiltSave,
  colossusMoney,
  colossusSeed,
  rendezvousFailureSeed,
} from "./seeds";

test.use({ viewport: missionViewport });

/** Where the camera is at each shot, as the scene reports it. */
const solarSystemCamera = "0.000 3.500 2.100";
const earthOrbitCamera = "-11.500 2.200 8.000";

function currentView(page: Page) {
  return page.getByTestId("current-view");
}

function scene(page: Page) {
  return page.getByTestId("mission-scene");
}

/**
 * Continues a Program with the Meridian Colossus developed, then launches it full and plays at 1x up to the event with this title,
 * recording every position the camera takes from the solar system's shot.
 */
async function launchOnColossus(
  page: Page,
  seed: number,
  pauseAt: string,
): Promise<void> {
  await overrideProgramData(page, { startingMoneyMillions: colossusMoney });
  await continueFromSave(page, colossusBuiltSave(seed));
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-colossus");
  await chooseAssets(page, [
    "Pathfinder Orbiter",
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  // Held as soon as Mission Mode opens, so the camera can be watched from its first shot.
  await launchHeld(page);
  const canvas = scene(page).locator("canvas");
  await expect(canvas).toHaveAttribute(
    "data-camera-position",
    solarSystemCamera,
  );
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const seen: string[] = [];
    Object.assign(window, { cameraPositions: seen });
    new MutationObserver(() => {
      const position = element.dataset.cameraPosition ?? "";
      if (seen.at(-1) !== position) seen.push(position);
    }).observe(element, {
      attributes: true,
      attributeFilter: ["data-camera-position"],
    });
  });
  await pauseAtEvent(page, pauseAt, () =>
    page.getByRole("button", { name: "1x" }).click(),
  );
}

/**
 * Holds the Turn from inside the page once the spacecraft view shows the Mission in Earth orbit at this stage. It
 * resolves then, so start it before anything that sets the Turn going.
 */
function holdEarthOrbitAt(page: Page, stage: string): Promise<void> {
  return page.evaluate(
    (wanted) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(function check() {
          const shown = document.querySelector<HTMLElement>(
            "[data-testid=mission-scene]",
          )?.dataset.earthOrbit;
          if (shown === wanted) {
            [...document.querySelectorAll("button")]
              .find((button) => button.textContent === "Pause")
              ?.click();
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        });
      }),
    stage,
  );
}

test("moves smoothly to the spacecraft view for the rendezvous, which pausing holds, and shows the Tanker docking to refuel", async ({
  page,
}) => {
  // Over 5 s: waits 2 s on purpose to show that pausing holds it, and plays the docking, which takes real time.
  const problems = watchForProblems(page);
  await launchOnColossus(page, colossusSeed, "Rendezvous");

  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(scene(page)).toHaveAttribute("data-earth-orbit", "approaching");
  await expect(scene(page).locator("canvas")).toHaveAttribute(
    "data-camera-position",
    earthOrbitCamera,
  );
  // The camera eased across from the solar system in steps, rather than jumping.
  const path = await page.evaluate(
    () => (window as unknown as { cameraPositions: string[] }).cameraPositions,
  );
  expect(new Set(path).size).toBeGreaterThan(4);
  await expect(page.getByTestId("spacecraft-asset")).toHaveText([
    "Pathfinder Orbiter",
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  await expect(page.getByTestId("spacecraft-tanker")).toHaveText("Tanker");
  await expect(page.getByTestId("spacecraft-status")).toContainText(
    "Rendezvous: the Tanker is coming in to dock",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  // Pausing holds the animation where it is.
  const heldAt = await scene(page).getAttribute("data-rendezvous-ms");
  await page.waitForTimeout(2000);
  await expect(scene(page)).toHaveAttribute("data-rendezvous-ms", heldAt ?? "");
  await expect(scene(page)).toHaveAttribute("data-earth-orbit", "approaching");

  // The player can still look elsewhere, and back.
  await viewButton(page, "Solar system").click();
  await expect(currentView(page)).toHaveText("Solar system");
  await expect(scene(page)).not.toHaveAttribute("data-earth-orbit", /./);
  await viewButton(page, "Spacecraft").click();
  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(scene(page)).toHaveAttribute("data-earth-orbit", "approaching");

  const docked = holdEarthOrbitAt(page, "refuelling");
  await page.getByRole("button", { name: "1x" }).click();
  await docked;
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(page.getByTestId("spacecraft-status")).toContainText(
    "Orbital refuelling: taking on propellant from the Tanker",
  );
  await expect(page.getByTestId("spacecraft-lost")).toHaveCount(0);
  expect(await termsWithoutTooltips(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("moves to the spacecraft view for a failed rendezvous, shows the collision, and then moves on to the solar system", async ({
  page,
}) => {
  // Over 5 s: plays at 1x for the seconds the collision and the wreck stay on screen.
  const problems = watchForProblems(page);
  await launchOnColossus(page, rendezvousFailureSeed, "Rendezvous failed");

  await expect(currentView(page)).toHaveText("Spacecraft");
  await expect(scene(page)).toHaveAttribute("data-earth-orbit", "approaching");
  // Nothing is lost until they collide, though the Timeline already knows it will be.
  await expect(page.getByTestId("spacecraft-asset")).toHaveCount(3);
  await expect(page.getByTestId("spacecraft-lost")).toHaveCount(0);

  const collided = holdEarthOrbitAt(page, "collided");
  await page.getByRole("button", { name: "1x" }).click();
  await collided;
  await expect(page.getByTestId("current-speed")).toHaveText("Paused");
  await expect(page.getByTestId("spacecraft-lost")).toHaveText([
    "Pathfinder Orbiter: lost",
    "Prospector Lander: lost",
    "Trailblazer Rover: lost",
  ]);
  await expect(page.getByTestId("spacecraft-tanker")).toHaveText(
    "Tanker: wrecked",
  );
  // The term stays on the label's line, rather than taking the label's own placement.
  await expect(
    page.getByTestId("spacecraft-tanker").locator(".term"),
  ).toHaveCSS("display", "inline");
  await expect(page.getByTestId("spacecraft-status")).toContainText(
    "Rendezvous failed: the Mission and the Tanker collided",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "1x" }).click();
  await expect(currentView(page)).toHaveText("Solar system");
  await expect(page.getByTestId("turn-summary")).toHaveCount(0);
  await expect(viewButton(page, "Spacecraft")).toBeDisabled();
  expect(problems).toEqual([]);
});
