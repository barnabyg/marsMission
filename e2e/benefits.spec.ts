import { expect, test } from "@playwright/test";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import {
  chooseAssets,
  missionViewport,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { landerAndRoverMoney, relayAndLanderSeed } from "./seeds";

test.use({ viewport: missionViewport });

const relay = realCatalogueFiles().assets.find(
  ({ id }) => id === "courier-relay-orbiter",
);
const raised = `Courier Relay's Benefit adds ${String(relay?.benefit?.percent)}% on the surface.`;

test("puts a relay orbiter at Mars beside a lander and sees the raised earnings", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await overrideProgramData(page, {
    startingMoneyMillions: landerAndRoverMoney,
  });
  await page.goto(`/?seed=${relayAndLanderSeed}`);
  await page
    .getByRole("combobox", { name: "Launch Vehicle" })
    .selectOption("meridian-heavy");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  const tag = page
    .locator(".asset-choice", { hasText: "Courier Relay" })
    .getByTestId("benefit-tag");
  // Nothing is on the surface yet, so it would add nothing this Turn.
  await expect(tag).toHaveText("Benefit +0 Science");
  // Only the relay raises research; the fuel plant's tag is for the propellant it makes.
  await expect(
    page.getByTestId("benefit-tag").filter({ hasText: "Science" }),
  ).toHaveCount(1);
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Courier Relay: Raises the Ongoing Research of every Asset and Crew on the surface",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "nothing on the surface is doing research",
  );
  // The lander's Activity choice says on hovering which Benefit raises it, once the relay is on the Mission too.
  await chooseAssets(page, ["Prospector Lander"]);
  const landerActivity = page.getByLabel("Activity for Prospector Lander");
  await expect(landerActivity).not.toHaveAttribute("title", /Benefit/);

  await chooseAssets(page, ["Prospector Lander", "Courier Relay"]);
  await expect(
    page.locator(".mission-panel").getByTestId("activity-earnings").first(),
  ).toContainText("Surface research earns");
  await expect(landerActivity).toHaveAttribute("title", new RegExp(raised));
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Launch Mission" }).click();

  // The relay orbiter arrives before the lander lands, so every day of the lander's research is raised.
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  const earned = page.getByTestId("summary-ongoing-research");
  await expect(earned).toContainText(
    /Prospector Lander, Surface research: \d+ Science and \d+ Public Support over (\d+) days, raised on \1 of them by the Benefit from Courier Relay, which added \d+ Science/,
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  const operating = page.locator(".panel", { hasText: "Operating at Mars" });
  await expect(
    operating.getByLabel("Activity for Prospector Lander"),
  ).toHaveAttribute("title", new RegExp(raised));
  // With one already operating, another would add nothing.
  await expect(tag).toHaveText("Benefit +0 Science");
  await tag.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Courier Relay at Mars already gives this Benefit",
  );
  expect(problems).toEqual([]);
});
