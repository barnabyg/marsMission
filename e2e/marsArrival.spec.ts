import { expect, test } from "@playwright/test";
import { missionViewport } from "./helpers";
import { launchFirstMission, holdSceneAt } from "./playbackHelpers";
import { chooseAssets } from "./planningHelpers";
import { crashSeed, landingSeed, seedFailingAt, successSeed } from "./seeds";

test.use({ viewport: missionViewport });

for (const outcome of ["orbit", "flyby"] as const) {
  test(`plays Mars capture to the recorded ${outcome} at 20x for an orbiter-only Mission`, async ({
    page,
  }) => {
    const captured = outcome === "orbit";
    await launchFirstMission(
      page,
      captured ? successSeed : seedFailingAt("Mars orbit insertion"),
      captured ? "Mars orbit insertion" : "Mars orbit insertion failed",
      "20x",
    );
    const scene = page.getByTestId("mission-scene");
    await expect(scene).toHaveAttribute("data-mars-capture", "burn");
    const ended = holdSceneAt(page, "marsCapture", outcome);
    await page.getByRole("button", { name: "20x", exact: true }).click();
    await ended;
    await expect(
      page.getByRole("heading", { name: /^Mars orbit insertion/ }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "20x", exact: true }).click();
    await expect(page.getByTestId("turn-summary")).toBeVisible();
    const events = page.getByTestId("summary-mission-event");
    await expect(
      events.filter({ hasText: "Mars orbit insertion" }),
    ).toHaveCount(1);
    await expect(
      events.filter({ hasText: "Entry/descent/landing" }),
    ).toHaveCount(0);
  });
}

for (const result of ["touchdown", "impact"] as const) {
  test(`stages atmospheric entry, descent and ${result} at the planned site`, async ({
    page,
  }) => {
    await page.goto(`/?seed=${result === "impact" ? crashSeed : landingSeed}`);
    await chooseAssets(page, ["Prospector Lander"]);
    const scene = page.getByTestId("mission-scene");
    const first = holdSceneAt(page, "landingPhase", "entry");
    await page.getByRole("button", { name: "Launch Mission" }).click();
    const fast = page.getByRole("button", { name: "20x", exact: true });
    await fast.click();
    await first;
    for (const phase of ["descent", result]) {
      const reached = holdSceneAt(page, "landingPhase", phase);
      await fast.click();
      await reached;
      await expect(scene).toHaveAttribute("data-landing-phase", phase);
      await expect(page.getByTestId("surface-site")).toHaveText(
        "Jezero Crater",
      );
      await expect(page.getByTestId("surface-status")).toContainText(
        "Prospector Lander",
      );
    }
  });
}
