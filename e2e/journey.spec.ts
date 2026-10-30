import { expect, test, type Page } from "@playwright/test";
import { termPattern, tooltips } from "../src/ui/tooltips";
import { storageKeyFor } from "../src/save/saveStore";
import { productionBaseURL } from "../playwright.config";
import { seedFailingAt, successSeed } from "./seeds";

/**
 * @react-three/fiber 9.8.2 still creates a THREE.Clock, which three 0.187 warns about on load. It's
 * harmless and not ours to fix. Remove this exception once a @react-three/fiber upgrade stops it.
 */
const knownThirdPartyWarning =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

/** Fails the test on anything the browser reports as a problem. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.text() === knownThirdPartyWarning) return;
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(message.text());
    }
  });
  return problems;
}

/** Returns any game term on screen that has no tooltip. */
function termsWithoutTooltips(page: Page): Promise<string[]> {
  return page.evaluate((pattern) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const missing: string[] = [];
    while (walker.nextNode()) {
      const { parentElement, textContent } = walker.currentNode;
      if (
        parentElement?.closest("[data-term], [role=tooltip], script, style")
      ) {
        continue;
      }
      missing.push(...(textContent?.match(new RegExp(pattern, "g")) ?? []));
    }
    return missing;
  }, termPattern.source);
}

/** Plays out a Turn in Mission Mode, whatever happens in it, and continues past its Turn summary. */
async function playToNextTurn(page: Page): Promise<void> {
  const screen = page.getByTestId("text-screen");
  const summary = page.getByTestId("turn-summary");
  while (!(await summary.isVisible())) {
    if (await screen.isVisible()) {
      await screen.getByRole("button", { name: "Continue" }).click();
    }
  }
  await summary.getByRole("button", { name: "Continue" }).click();
}

test("plays from a new Program through a launch to the next Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  await expect(page.getByTestId("launch-window")).toHaveText("December 2028");
  await expect(page.getByTestId("money")).toHaveText("$2B");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1B at 300 (200 away)",
  );

  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();

  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("current-speed")).toHaveText("1x");
  await page.getByRole("button", { name: "10x" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("10x");

  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
  await expect(page.getByTestId("operating-at-mars")).toHaveText("Nothing yet");

  const screen = page.getByTestId("text-screen");
  for (const title of [
    "Launch",
    "Mars transfer burn",
    "Mars orbit insertion",
    "First orbiter at Mars",
    "Funding Threshold reached: 300 Public Support",
  ]) {
    await expect(screen.getByRole("heading")).toHaveText(title);
    expect(await termsWithoutTooltips(page)).toEqual([]);
    // Checked here because the rest of the Turn is over in moments at this test's time scale.
    if (title === "Funding Threshold reached: 300 Public Support") {
      await expect(page.getByTestId("journey-progress")).toHaveText(
        /Pathfinder Orbiter: arrived at Mars/,
      );
      await expect(page.getByTestId("operating-at-mars")).toHaveText(
        "Pathfinder Orbiter",
      );
    }
    await screen.getByRole("button", { name: "Continue" }).click();
  }

  const summary = page.getByTestId("turn-summary");
  await expect(summary).toContainText("First orbiter at Mars");
  await expect(summary).toContainText("100 Science");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(summary.getByTestId("summary-funding-payouts")).toContainText(
    "$1B",
  );
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("science")).toHaveText("100");
  await expect(page.getByTestId("public-support")).toHaveText("255");
  await expect(page.getByTestId("milestones")).toContainText(
    "First orbiter at Mars",
  );
  await expect(page.getByTestId("launch-window")).toHaveText("January 2031");
  await expect(page.getByTestId("money")).toHaveText("$2B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "None left",
  );
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("current-speed")).toHaveText("10x");
  expect(problems).toEqual([]);
});

for (const { missionEvent, before } of [
  { missionEvent: "Launch", before: [] },
  { missionEvent: "Mars transfer burn", before: ["Launch"] },
  {
    missionEvent: "Mars orbit insertion",
    before: ["Launch", "Mars transfer burn"],
  },
]) {
  test(`plays a Mission that fails at ${missionEvent} through to the next Turn`, async ({
    page,
  }) => {
    const problems = watchForProblems(page);
    await page.goto(`/?seed=${seedFailingAt(missionEvent)}`);
    await page.getByRole("button", { name: "Launch Mission" }).click();

    const screen = page.getByTestId("text-screen");
    for (const title of before) {
      await expect(screen.getByRole("heading")).toHaveText(title);
      await screen.getByRole("button", { name: "Continue" }).click();
    }

    await expect(screen.getByRole("heading")).toHaveText(
      `${missionEvent} failed`,
    );
    await expect(screen).toContainText("Pathfinder Orbiter");
    expect(await termsWithoutTooltips(page)).toEqual([]);
    await expect(page.getByTestId("journey-progress")).toHaveText(
      /lost, and will not reach Mars/,
    );
    await expect(page.getByTestId("operating-at-mars")).toHaveText(
      "Nothing yet",
    );
    await screen.getByRole("button", { name: "Continue" }).click();

    // No later Mission Event appears: the next thing on screen is the Turn summary.
    const summary = page.getByTestId("turn-summary");
    await expect(summary).toBeVisible();
    const failure = summary.getByTestId("summary-failure");
    await expect(failure).toContainText(missionEvent);
    await expect(failure).toContainText("Pathfinder Orbiter");
    await expect(failure).toContainText("Public Support lost: 20");
    expect(await termsWithoutTooltips(page)).toEqual([]);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("turn-number")).toHaveText("2");
    await expect(page.getByTestId("public-support")).toHaveText("68");
    await expect(page.getByTestId("science")).toHaveText("0");
    await expect(page.getByTestId("money")).toHaveText("$1B");
    await expect(page.getByTestId("operating-assets")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}

test("uses a known seed in a production build, as the playtest command runs it", async ({
  page,
}) => {
  await page.goto(`${productionBaseURL}/?seed=${seedFailingAt("Launch")}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(page.getByTestId("text-screen").getByRole("heading")).toHaveText(
    "Launch failed",
  );
});

test("lists the planned Mission's Mission Events with rough risk bands, which change with what it carries", async ({
  page,
}) => {
  await page.route("**/data/assets.json", async (route) => {
    const response = await route.fetch();
    const assets = (await response.json()) as Record<string, unknown>[];
    await route.fulfill({
      json: [
        ...assets,
        {
          id: "test-probe",
          name: "Flyby Probe",
          kind: "orbiter",
          costMillions: 100,
          missionEvents: [],
        },
      ],
    });
  });
  await page.goto("/");

  const events = page.getByTestId("mission-event");
  await expect(events).toHaveCount(3);
  await expect(events.nth(0)).toContainText("Launch");
  await expect(events.nth(1)).toContainText("Mars transfer burn");
  await expect(events.nth(2)).toContainText("Mars orbit insertion");
  for (const band of await page.getByTestId("risk-band").allTextContents()) {
    expect(band).toMatch(/^(~\d+%|Over \d+%)$/);
  }
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByLabel("Asset").selectOption("test-probe");
  await expect(events).toHaveCount(2);
  await expect(page.getByTestId("mission-events")).not.toContainText(
    "Mars orbit insertion",
  );

  // Everything on the Mission panel stays on screen at 3840×2160.
  const launch = page.getByRole("button", { name: "Launch Mission" });
  await expect(launch).toBeInViewport();
});

test("buys Reliability, sees the risk band and cost change, and launches", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto(`/?seed=${successSeed}`);

  const insertion = page
    .getByTestId("mission-event")
    .filter({ hasText: "Mars orbit insertion" });
  const band = insertion.getByTestId("risk-band");
  const bandBefore = await band.textContent();
  const costBefore = await page.getByTestId("mission-cost").textContent();
  await expect(insertion.getByRole("combobox")).toHaveValue("none");

  await insertion.getByRole("combobox").selectOption("redundant");
  await expect(band).not.toHaveText(bandBefore ?? "");
  await expect(page.getByTestId("mission-cost")).not.toHaveText(
    costBefore ?? "",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission Mode" }),
  ).toBeVisible();
  await playToNextTurn(page);

  // Reliability applied to that Mission only.
  await expect(page.getByTestId("turn-number")).toHaveText("2");
  await expect(page.getByTestId("mission-cost")).toHaveText(costBefore ?? "");
  await expect(insertion.getByRole("combobox")).toHaveValue("none");
  expect(problems).toEqual([]);
});

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

test("explains a game term on hover and on keyboard focus", async ({
  page,
}) => {
  await page.goto("/");

  const term = page.locator("dt [data-term='Public Support']");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveCount(0);

  await term.hover();
  await expect(tooltip).toContainText(tooltips["Public Support"]);

  await page.getByRole("heading", { name: "Mission", exact: true }).hover();
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await term.focus();
  await expect(tooltip).toContainText(tooltips["Public Support"]);
  await term.blur();
  await expect(tooltip).toHaveCount(0);
});

test("retires a Program and starts a new one from the Program summary", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Retire Program" }).click();
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retire Program" }).click();
  await page.getByRole("button", { name: "Yes, retire the Program" }).click();

  const summary = page.getByTestId("program-summary");
  await expect(summary).toContainText("You retired this Program");
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await expect(summary.getByTestId("total-science")).toHaveText("0");

  await page.getByRole("button", { name: "Start a new Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("1");
  expect(problems).toEqual([]);
});

test("lets a Turn pass without launching, and cancels the Program when Public Support falls too far", async ({
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
  await expect(page.getByTestId("journey-progress")).toHaveText(
    "No Mission this Turn",
  );

  const turnSummary = page.getByTestId("turn-summary");
  await expect(turnSummary).toContainText("cancelled");
  await expect(turnSummary.getByTestId("summary-public-support")).toHaveText(
    "100 to 85",
  );
  await page.getByRole("button", { name: "Continue" }).click();

  const programSummary = page.getByTestId("program-summary");
  await expect(programSummary).toContainText(
    "below the Cancellation Level of 90",
  );
});

test("shows why a plan the player can't afford is rejected", async ({
  page,
}) => {
  await page.route("**/data/program.json", async (route) => {
    const response = await route.fetch();
    const program = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      json: { ...program, startingMoneyMillions: 500 },
    });
  });
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText("costs $1B");
  await expect(page.getByRole("alert")).toContainText("$500M");
  await expect(
    page.getByRole("button", { name: "Launch Mission" }),
  ).toBeDisabled();
});

test("refuses to load invalid data files, with a clear error", async ({
  page,
}) => {
  await page.route("**/data/assets.json", (route) =>
    route.fulfill({
      json: [{ id: "broken", name: "Broken", kind: "orbiter" }],
    }),
  );
  await page.goto("/");

  const error = page.getByRole("alert");
  await expect(error).toContainText("assets.json");
  await expect(error).toContainText("costMillions");
  await expect(
    page.getByRole("heading", { name: "Planning Mode" }),
  ).toHaveCount(0);
});
