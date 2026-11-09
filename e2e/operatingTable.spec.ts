import { expect, test } from "@playwright/test";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { openBusyProgram } from "./busyProgram";
import { missionViewport, operatingRow, termsWithoutTooltips } from "./helpers";

/** Operating at Mars as a table, on the smallest supported screen, where a busy Program has more rows than fit. */

test.use({ viewport: missionViewport });

const crewNames = realCatalogueFiles().crew.names.slice(0, 4);

test("lists each Crew member and Asset on a line or two, numbers Assets of one kind, and says when more rows are below", async ({
  page,
}) => {
  await openBusyProgram(page, { crewAtMars: true, samplesWaiting: true });
  const panel = page.getByTestId("operating-panel");
  // Six orbiters, a lander and a rover, and four Crew.
  await expect(panel.getByRole("heading")).toHaveText("Operating at Mars · 12");
  const rem = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  );

  // Crew are grouped under their place, with their Supplies on the group's line and one row for each member.
  const crew = page.getByTestId("crew-at-mars");
  await expect(crew.getByTestId("crew-group")).toContainText(
    "Crew in Mars orbit · Supplies for 2,187 days",
  );
  const members = crew.getByTestId("crew-member");
  await expect(members).toHaveText(
    crewNames.map((name) => new RegExp(`^${name}Health 100$`)),
  );
  for (const member of await members.locator("td").first().all()) {
    const box = await member.boundingBox();
    expect(box?.height ?? Infinity).toBeLessThan(1.8 * rem);
  }

  // Assets are grouped by where they are, those of one kind numbered as they arrived.
  const assets = page.getByTestId("operating-assets");
  await expect(assets.locator(".operating-group")).toHaveText([
    "Mars orbit",
    "Jezero Crater",
  ]);
  const rows = page.getByTestId("operating-asset");
  await expect(rows.locator(".operating-name")).toHaveText([
    ...[1, 2, 3, 4, 5, 6].map((n) => `Pathfinder Orbiter ${String(n)}`),
    "Prospector Lander",
    "Trailblazer Rover",
  ]);
  await expect(operatingRow(page, "Pathfinder Orbiter 6")).toContainText(
    /[\d,]+ days/,
  );
  await expect(
    operatingRow(page, "Pathfinder Orbiter 6").getByRole("checkbox", {
      name: "End the mission of Pathfinder Orbiter 6",
    }),
  ).toBeVisible();
  for (const row of await rows.all()) {
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    // Two lines at most: a choice is about as tall as two lines of text.
    expect(box?.height ?? Infinity).toBeLessThan(3.2 * rem);
  }

  // More rows than fit, which the panel says, until it is scrolled to its end.
  const cue = panel.getByTestId("more-below");
  await panel.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(cue).toBeVisible();
  await expect(cue).toHaveText("More below");
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(cue).toBeHidden();
  expect(await termsWithoutTooltips(page)).toEqual([]);
});
