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
  const relayCard = page.locator(".asset-choice", { hasText: "Courier Relay" });
  const tag = relayCard.getByTestId("benefit-tag");
  // Nothing is on the surface yet, so it would add nothing this Turn: no "+0" tag, and its details say why.
  await expect(relayCard.getByTestId("asset-mass")).toBeVisible();
  await expect(tag).toHaveCount(0);
  await expect(
    page.getByTestId("benefit-tag").filter({ hasText: "Science" }),
  ).toHaveCount(0);
  await relayCard.getByRole("button", { name: "About Courier Relay" }).click();
  const benefitDetail = page
    .getByRole("dialog", { name: "Courier Relay" })
    .getByTestId("detail-Benefit");
  await expect(benefitDetail).toContainText(
    "Raises the Ongoing Research of every Asset and Crew on the surface",
  );
  await expect(benefitDetail).toContainText(
    "nothing on the surface is doing research",
  );
  await page.getByRole("button", { name: "Close" }).click();
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
  await page.getByRole("button", { name: /^Skip to / }).click();
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
  // With one already operating, another would add nothing, which its details say.
  await expect(relayCard.getByTestId("operating-tag")).toHaveText("1 at Mars");
  await expect(tag).toHaveCount(0);
  await relayCard.getByRole("button", { name: "About Courier Relay" }).click();
  await expect(benefitDetail).toContainText(
    "Courier Relay at Mars already gives this Benefit",
  );
  await page.getByRole("button", { name: "Close" }).click();
  expect(problems).toEqual([]);
});
