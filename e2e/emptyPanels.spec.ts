import { expect, test } from "@playwright/test";
import { termsWithoutTooltips } from "./helpers";
import { chooseAssets } from "./planningHelpers";
import { endTurnAndContinue } from "./turnHelpers";
import { successSeed } from "./seeds";

test("empty Planning Mode panels shrink to a line, and grow once an Asset is operating and a Milestone earned", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const operating = page.getByTestId("operating-panel");
  const milestones = page.getByTestId("milestones-panel");
  await expect(operating).toContainText(
    "Nothing at Mars yet. Your first orbiter will appear here.",
  );
  await expect(milestones).toContainText(
    "No Milestones yet. Your first arrival at Mars will earn one.",
  );
  // Each is about one line high, rather than half the column.
  for (const panel of [operating, milestones]) {
    const box = await panel.boundingBox();
    expect(box?.height).toBeLessThan(120);
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  await expect(
    page.getByTestId("milestones").getByRole("listitem"),
  ).not.toHaveCount(0);
  await expect(operating).not.toContainText("Nothing at Mars yet");
  await expect(milestones).not.toContainText("No Milestones yet");
  expect((await operating.boundingBox())?.height).toBeGreaterThan(200);
});
