import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import {
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

test("keeps a Program between sessions: launches, reaches the next Turn, reloads and continues", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await playToNextTurn(page);
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
  await page.getByRole("button", { name: "Launch Mission" }).click();
  const heading = page.getByTestId("text-screen").getByRole("heading");
  await expect(heading).toHaveText("Launch failed");

  await page.reload();
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
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
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await page.reload();
  await page.getByRole("button", { name: "Start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});

test("can't continue a Program that has ended", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Retire Program" }).click();
  await page.getByRole("button", { name: "Yes, retire the Program" }).click();
  await expect(page.getByTestId("program-summary")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Continue this Program" }),
  ).toHaveCount(0);
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

test("saves to a slot, moves on a Turn, loads the slot and sees the earlier state", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  const slot = page.getByTestId("save-slot-1");
  await expect(slot).toContainText("Empty");
  await expect(page.getByTestId("save-slot-2")).toContainText("Empty");
  await expect(page.getByTestId("save-slot-3")).toContainText("Empty");
  await slot.getByRole("button", { name: "Save here" }).click();
  await expect(slot).toContainText("Turn 1");
  await expect(slot).toContainText("December 2028");
  await expect(slot).toContainText(
    (await page.getByTestId("money").textContent()) ?? "",
  );
  await expect(slot).toContainText("100 Public Support");
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  // Mission Mode offers no saving.
  await expect(page.getByText("Save here")).toHaveCount(0);
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await slot.getByRole("button", { name: "Load" }).click();
  const confirmLoad = page.getByRole("dialog", { name: "Confirm loading" });
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await confirmLoad.getByRole("button", { name: "Yes, load it" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(page.getByTestId("public-support")).toHaveText("100");
  await expect(page.getByTestId("science")).toHaveText("0");
  await expect(page.getByTestId("operating-assets")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("resets the plan when loading a slot of the same Program and Turn", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  const slot = page.getByTestId("save-slot-1");
  await slot.getByRole("button", { name: "Save here" }).click();

  const launchReliability = page
    .getByTestId("mission-event")
    .filter({ hasText: "Launch" })
    .getByRole("combobox");
  await launchReliability.selectOption("redundant");

  await slot.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Yes, load it" }).click();
  await expect(launchReliability).toHaveValue("none");
});

test("asks before a slot loaded when reopening the game replaces the automatic save", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Save here" })
    .click();
  await page.reload();

  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Load" })
    .click();
  await expect(page.getByTestId("opening-screen")).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(
    page.getByRole("button", { name: "Continue this Program" }),
  ).toBeVisible();
});

test("can't continue a cancelled Program after seeing how it ended", async ({
  page,
}) => {
  await page.route("**/data/program.json", async (route) => {
    const response = await route.fetch();
    const program = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ json: { ...program, cancellationLevel: 90 } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await playToNextTurn(page);
  await expect(page.getByTestId("program-summary")).toContainText("cancelled");

  await page.reload();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Continue this Program" }),
  ).toHaveCount(0);
});

test("asks before overwriting a used slot", async ({ page }) => {
  await page.goto(`/?seed=${successSeed}`);
  const slot = page.getByTestId("save-slot-1");
  await slot.getByRole("button", { name: "Save here" }).click();
  await expect(slot).toContainText("Turn 1");

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await slot.getByRole("button", { name: "Save here" }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm overwriting" });
  await expect(confirm).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(slot).toContainText("Turn 1");
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(slot).toContainText("Turn 1");

  await slot.getByRole("button", { name: "Save here" }).click();
  await confirm.getByRole("button", { name: "Yes, overwrite it" }).click();
  await expect(slot).toContainText("Turn 2");
});

test("reaches the slots when reopening the game, even with no automatic save", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByTestId("save-slot-2")
    .getByRole("button", { name: "Save here" })
    .click();
  await page.getByRole("button", { name: "Retire Program" }).click();
  await page.getByRole("button", { name: "Yes, retire the Program" }).click();
  await expect(page.getByTestId("program-summary")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("opening-screen")).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Continue this Program" }),
  ).toHaveCount(0);
  await page
    .getByTestId("save-slot-2")
    .getByRole("button", { name: "Load" })
    .click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});

test("gives a clear message for a corrupt slot, without affecting the others", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Save here" })
    .click();
  await page.evaluate(
    ([key]) => {
      localStorage.setItem(key, "{not json");
    },
    [storageKeyFor(2)] as const,
  );
  await page.reload();

  const corrupt = page.getByTestId("save-slot-2");
  await expect(corrupt).toContainText("corrupt");
  await expect(corrupt.getByRole("button", { name: "Load" })).toHaveCount(0);
  await expect(page.getByTestId("save-slot-1")).toContainText("Turn 1");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("save-slot-2")).toContainText("corrupt");
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});
