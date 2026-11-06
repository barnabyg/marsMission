import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import {
  cancelledAfterOneTurn,
  chooseAssets,
  endTurnAndContinue,
  endTurnWithoutLaunching,
  eventEntries,
  missionViewport,
  overrideProgramData,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

test.use({ viewport: missionViewport });

test("keeps a Program between sessions: launches, reaches the next Turn, reloads and continues", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await endTurnAndContinue(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  const state = {
    money: await page.getByTestId("money").textContent(),
    publicSupport: await page.getByTestId("public-support").textContent(),
    science: await page.getByTestId("science").textContent(),
    launchWindow: await page.getByTestId("launch-window").textContent(),
  };

  await page.reload();
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue this Program" }).click();

  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("money")).toHaveText(state.money ?? "");
  await expect(page.getByTestId("public-support")).toHaveText(
    state.publicSupport ?? "",
  );
  await expect(page.getByTestId("science")).toHaveText(state.science ?? "");
  await expect(page.getByTestId("launch-window")).toHaveText(
    state.launchWindow ?? "",
  );
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(problems).toEqual([]);
});

test("returns to the start of the Turn after a reload in Mission Mode, and the same plan gives the same outcome", async ({
  page,
}) => {
  await page.goto(`/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const heading = eventEntries(page).first().getByRole("heading");
  await expect(heading).toHaveText("Launch failed");

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(heading).toHaveText("Launch failed");
});

test("starts a new Program instead of continuing, when asked", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await endTurnAndContinue(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await page.reload();
  await page.getByRole("button", { name: "Start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});

test("continues the new Program after a restart, not the one it replaced", async ({
  page,
}) => {
  await page.goto("/");
  await endTurnWithoutLaunching(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await page.getByRole("button", { name: "Restart Program" }).click();
  await page.getByRole("button", { name: "Yes, start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});

for (const [name, contents, message] of [
  ["corrupt", "{not json", "corrupt"],
  ["from an unknown format version", '{"formatVersion":99}', "format 99"],
] as const) {
  test(`gives a clear message for an automatic save that is ${name}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [storageKeyFor("automatic"), contents] as const,
    );
    await page.reload();

    await expect(page.getByRole("alert")).toContainText(message);
    await expect(
      page.getByRole("button", { name: "Continue this Program" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Start a new Program" }).click();
    await expect(page.getByTestId("turn-number")).toHaveText("1");
  });
}

test("can't continue a cancelled Program after seeing how it ended", async ({
  page,
}) => {
  await overrideProgramData(page, cancelledAfterOneTurn);
  await page.goto("/");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await endTurnAndContinue(page);
  await expect(page.getByTestId("program-summary")).toContainText("cancelled");

  await page.reload();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Continue this Program" }),
  ).toHaveCount(0);
});
