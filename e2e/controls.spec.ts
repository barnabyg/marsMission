import { expect, test, type Locator } from "@playwright/test";
import { chooseAssets, missionViewport } from "./helpers";
import { successSeed } from "./seeds";

function backgroundOf(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).background);
}

test("headings use the bundled display font, loaded from the game's own files", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(request.url());
  });
  await page.goto(`/?seed=${successSeed}`);
  const heading = page.getByRole("heading", {
    name: "New Mission",
    exact: true,
  });
  await expect(heading).toHaveCSS("font-family", /^"Barlow Condensed"/);
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('600 28px "Barlow Condensed"');
    }),
  ).toBe(true);
  expect(fontRequests.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  for (const url of fontRequests) expect(new URL(url).origin).toBe(origin);
  // Body text stays in the system font.
  await expect(page.locator("body")).toHaveCSS("font-family", /^"Segoe UI"/);
});

test("buttons change when hovered and pressed, and disabled ones don't", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page.mouse.move(0, 0);
  const save = page.getByRole("button", { name: "Save", exact: true });
  const resting = await backgroundOf(save);
  await save.hover();
  await expect.poll(() => backgroundOf(save)).not.toBe(resting);
  const hovered = await backgroundOf(save);
  await page.mouse.down();
  await expect.poll(() => backgroundOf(save)).not.toBe(hovered);
  await page.mouse.up();
  await page.keyboard.press("Escape");

  const trajectory = page.getByRole("combobox", { name: "Trajectory" });
  await page.mouse.move(0, 0);
  const selectResting = await backgroundOf(trajectory);
  await trajectory.hover();
  await expect.poll(() => backgroundOf(trajectory)).not.toBe(selectResting);

  // Nothing is ticked, so Launch Mission is disabled.
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toBeDisabled();
  await page.mouse.move(0, 0);
  const disabledResting = await backgroundOf(launch);
  await launch.hover();
  // Long enough for a transition to have started, if there were one.
  await page.waitForTimeout(300);
  expect(await backgroundOf(launch)).toBe(disabledResting);
});

test("every control in Planning Mode shows the same focus style when tabbed to", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const styles = new Set<string>();
  let stops = 0;
  for (let press = 0; press < 40; press++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
    });
    if (!focused) continue;
    stops++;
    styles.add(focused);
  }
  expect(stops).toBeGreaterThan(10);
  expect([...styles]).toEqual(["solid 3px rgb(140, 200, 255)"]);
});

test("closing any dialog with Escape returns focus to the button that opened it", async ({
  page,
}) => {
  await page.setViewportSize(missionViewport);
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByTestId("tutorial-offer")
    .getByRole("button", { name: "Turn on Tutorial mode" })
    .click();
  await chooseAssets(page, ["Pathfinder Orbiter"]);

  async function escapeBackTo(opener: string, dialog: string) {
    const button = page.getByRole("button", { name: opener, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(button, dialog).toBeFocused();
  }

  await escapeBackTo("Save", "Save to a Save Slot");
  await escapeBackTo("Load", "Load from a Save Slot");
  await escapeBackTo("Restart Program", "Restart Program");
  await escapeBackTo("Glossary", "Glossary");
  await escapeBackTo(
    "End Turn without launching",
    "End Turn without launching",
  );

  // Ending the Turn leaves Planning Mode, so focus has nowhere to go back to there.
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await page
    .getByRole("dialog", { name: "End Turn without launching" })
    .getByRole("button", { name: "End Turn", exact: true })
    .click();
  await expect(page.getByTestId("mission-tutorial")).toBeVisible();
  await escapeBackTo("Turn off Tutorial mode", "Turn off Tutorial mode");
});
