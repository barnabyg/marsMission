import { expect, test } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { tooltips } from "../src/ui/tooltips";
import {
  cancelledAfterOneTurn,
  openLoadDialog,
  openSaveDialog,
  overrideProgramData,
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

  // Planning Mode has buttons for the Save Slots, not a panel of them.
  const slot = page.getByTestId("save-slot-1");
  await expect(slot).toHaveCount(0);
  await openSaveDialog(page);
  await expect(slot).toContainText("Empty");
  await expect(page.getByTestId("save-slot-2")).toContainText("Empty");
  await expect(page.getByTestId("save-slot-3")).toContainText("Empty");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await slot.getByRole("button", { name: "Save here" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Saved to Save Slot 1");

  await openSaveDialog(page);
  await expect(slot).toContainText("Turn 1");
  await expect(slot).toContainText("December 2028");
  await expect(slot).toContainText(
    (await page.getByTestId("money").textContent()) ?? "",
  );
  await expect(slot).toContainText("100 Public Support");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  // Mission Mode offers no saving.
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Load" })).toHaveCount(0);
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await openLoadDialog(page);
  await slot.getByRole("button", { name: "Load" }).click();
  const confirmLoad = page.getByRole("group", { name: "Confirm loading" });
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
  await openSaveDialog(page);
  await slot.getByRole("button", { name: "Save here" }).click();

  const launchReliability = page
    .getByTestId("mission-event")
    .filter({ hasText: "Launch" })
    .getByRole("combobox");
  await launchReliability.selectOption("redundant");

  await openLoadDialog(page);
  await slot.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Yes, load it" }).click();
  await expect(launchReliability).toHaveValue("none");
});

test("asks before a slot loaded when reopening the game replaces the automatic save", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await openSaveDialog(page);
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
  await overrideProgramData(page, cancelledAfterOneTurn);
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
  await openSaveDialog(page);
  await slot.getByRole("button", { name: "Save here" }).click();

  await page
    .getByRole("button", { name: "End Turn without launching" })
    .click();
  await playToNextTurn(page);
  await expect(page.getByTestId("turn-number")).toHaveText("2");

  await openSaveDialog(page);
  await slot.getByRole("button", { name: "Save here" }).click();
  const confirm = page.getByRole("group", { name: "Confirm overwriting" });
  await expect(confirm).toBeVisible();
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(slot).toContainText("Turn 1");
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(slot).toContainText("Turn 1");

  await slot.getByRole("button", { name: "Save here" }).click();
  await confirm.getByRole("button", { name: "Yes, overwrite it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openSaveDialog(page);
  await expect(slot).toContainText("Turn 2");
});

test("reaches the slots when reopening the game, even with no automatic save", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await openSaveDialog(page);
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
  await openSaveDialog(page);
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
  await expect(page.getByTestId("turn-number")).toHaveText("1");

  // Planning Mode's dialog says the same, and the game carries on.
  await openLoadDialog(page);
  await expect(corrupt).toContainText("corrupt");
  await expect(corrupt.getByRole("button", { name: "Load" })).toHaveCount(0);
  await expect(
    page.getByTestId("save-slot-1").getByRole("button", { name: "Load" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("save-slot-3").getByRole("button", { name: "Load" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
});

test("shows an unknown save format's message in the Load dialog", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  // The game reads storage as it starts, so wait until it has.
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await page.evaluate(
    ([key]) => {
      localStorage.setItem(key, '{"formatVersion":99}');
    },
    [storageKeyFor(3)] as const,
  );
  await openLoadDialog(page);
  await expect(page.getByTestId("save-slot-3")).toContainText("format 99");
});

test("closes the Save and Load dialogs with Escape or Cancel, changing nothing", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await openSaveDialog(page);
  await page.getByTestId("save-slot-1").getByRole("button").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const open of [openSaveDialog, openLoadDialog]) {
    await open(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await open(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // Escape part way through a confirmation changes nothing either.
  await openSaveDialog(page);
  const slot = page.getByTestId("save-slot-1");
  const before = await slot.locator(".save-slot-text").textContent();
  await slot.getByRole("button", { name: "Save here" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openLoadDialog(page);
  await slot.getByRole("button", { name: "Load" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("turn-number")).toHaveText("1");

  await openLoadDialog(page);
  await expect(slot.locator(".save-slot-text")).toHaveText(before ?? "");
});

test("explains game terms inside a dialog, above the dialog itself", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  await openSaveDialog(page);
  // Opening a dialog doesn't open a tooltip by focusing its first term.
  await expect(page.locator(".tooltip")).toHaveCount(0);
  await page.getByRole("dialog").locator("h2 [data-term='Save Slot']").hover();
  await expect(page.locator(".tooltip")).toContainText(tooltips["Save Slot"]);
  const onTop = await page.evaluate(() => {
    const tooltip = document.querySelector(".tooltip");
    return tooltip?.matches(":popover-open") ?? false;
  });
  expect(onTop).toBe(true);
});

test("says so in the dialog if the browser won't store a save", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  // The game reads storage as it starts, so wait until it has.
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage is full");
    };
  });
  await openSaveDialog(page);
  const slot = page.getByTestId("save-slot-1");
  await slot.getByRole("button", { name: "Save here" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "wouldn't store",
  );
  await expect(slot).toContainText("Empty");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("loads a save made before the Save and Load dialogs existed", async ({
  page,
}) => {
  await page.goto(`/?seed=${successSeed}`);
  // The game reads storage as it starts, so wait until it has.
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  // Format 1 as it was released, written out by hand so that a change to the format can't quietly change this test.
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor(1),
      JSON.stringify({
        formatVersion: 1,
        program: {
          seed: 1,
          turnNumber: 3,
          date: "2033-01-19",
          moneyMillions: 1300,
          publicSupport: 227,
          science: 100,
          milestoneIds: ["first-orbiter-at-mars"],
          fundingThresholdsPaid: [250],
          operatingAssets: [
            {
              assetId: "pathfinder-orbiter",
              name: "Pathfinder Orbiter",
              kind: "orbiter",
              arrivedOn: "2031-08-18",
            },
          ],
          status: { kind: "active" },
        },
      }),
    ] as const,
  );
  await openLoadDialog(page);
  await page
    .getByTestId("save-slot-1")
    .getByRole("button", { name: "Load" })
    .click();
  await page.getByRole("button", { name: "Yes, load it" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("3");
  await expect(page.getByTestId("public-support")).toHaveText("227");
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
});
