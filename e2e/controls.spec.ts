import { expect, test, type Locator } from "@playwright/test";
import { chooseAssets, missionViewport, viewButton } from "./helpers";
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

test("every button that can't be used is still reached by keyboard and says why, in the accessibility tree", async ({
  page,
}) => {
  await page.setViewportSize(missionViewport);
  /** Each button that can't be used here: none is natively disabled, and each is described by its reason. */
  async function expectReasons(least: number) {
    await expect(page.locator("button:disabled")).toHaveCount(0);
    const unavailable = page.locator("button[aria-disabled='true']");
    expect(await unavailable.count()).toBeGreaterThanOrEqual(least);
    for (const button of await unavailable.all()) {
      await expect(button).toHaveAccessibleDescription(/\w/);
    }
  }

  // Nothing is ticked on a new Program, so Launch Mission can't be used, and says so.
  await page.goto(`/?seed=${successSeed}`);
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toHaveAttribute("aria-disabled", "true");
  await expect(launch).toHaveAccessibleDescription(/\w/);
  await expectReasons(1);
  // Pressing it does nothing.
  await launch.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();

  // An orbiter alone lands nothing, so the Surface view's button says it has nothing to show.
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await expect(launch).not.toHaveAttribute("aria-disabled");
  await launch.click();
  await expect(viewButton(page, "Surface")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expectReasons(1);
});

test("Space pauses and resumes Mission Mode, the digits pick the speeds and M mutes", async ({
  page,
}) => {
  await page.setViewportSize(missionViewport);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const current = page.getByTestId("current-speed");
  const speeds = page.getByRole("group", { name: "Speed" });
  await expect(current).toHaveText("1x");

  await page.keyboard.press("Space");
  await expect(current).toHaveText("Paused");
  await page.keyboard.press("Space");
  await expect(current).toHaveText("1x");
  // In order, with each button's tooltip naming its key.
  for (const [key, name] of [
    ["2", "5x"],
    ["3", "10x"],
    ["4", "20x"],
    ["1", "1x"],
  ] as const) {
    await page.keyboard.press(key);
    await expect(current).toHaveText(name);
    await expect(speeds.getByRole("button", { name })).toHaveAttribute(
      "title",
      `Play at ${name}. Shortcut: ${key}`,
    );
  }
  const mute = page.getByRole("button", { name: "Mute sound" });
  await page.keyboard.press("m");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("m");
  await expect(mute).toHaveAttribute("aria-pressed", "false");

  // On a speed button just clicked, Space pauses rather than pressing it again, and resumes at its speed.
  await speeds.getByRole("button", { name: "5x" }).click();
  await page.keyboard.press("Space");
  await expect(current).toHaveText("Paused");
  await page.keyboard.press("Space");
  await expect(current).toHaveText("5x");

  // On any other button Space presses that button only.
  const marsOrbit = page.getByRole("button", { name: "Mars orbit" });
  await marsOrbit.focus();
  await page.keyboard.press("Space");
  await expect(marsOrbit).toHaveAttribute("aria-pressed", "true");
  await expect(current).toHaveText("5x");

  // Nor does it reach the page behind an open dialog.
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Glossary" })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(current).toHaveText("5x");
});
