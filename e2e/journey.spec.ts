import { expect, test } from "@playwright/test";
import { tooltips } from "../src/ui/tooltips";
import { productionBaseURL } from "../playwright.config";
import {
  cancelledAfterOneTurn,
  overrideProgramData,
  playToNextTurn,
  termsWithoutTooltips,
  watchForProblems,
} from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

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
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await expect(page.getByTestId("mission-cost")).toHaveText("$1B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "$1B at 250 (150 away)",
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
    "Funding Threshold reached: 250 Public Support",
  ]) {
    await expect(screen.getByRole("heading")).toHaveText(title);
    expect(await termsWithoutTooltips(page)).toEqual([]);
    // Checked here because the rest of the Turn is over in moments at this test's time scale.
    if (title === "Funding Threshold reached: 250 Public Support") {
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
  await expect(page.getByTestId("money")).toHaveText("$2.3B");
  await expect(page.getByTestId("next-funding-threshold")).toHaveText(
    "None left",
  );
  await expect(page.getByTestId("operating-assets")).toContainText(
    "Pathfinder Orbiter",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);

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
    await expect(page.getByTestId("money")).toHaveText("$1.3B");
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

test("loads the data files, Mission Mode's view and its art from a production build", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const artTypes: (string | undefined)[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/art/")) {
      artTypes.push(response.headers()["content-type"]);
    }
  });
  await page.goto(`${productionBaseURL}/?seed=${successSeed}`);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("solar-system-view").locator("canvas"),
  ).toBeVisible();
  // A failed file is only reported once its request ends, which can be after the canvas appears.
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
  // For a missing file, vite preview sends the game's page with status 200, and the browser reports no problem.
  expect(artTypes).toEqual(["image/jpeg", "image/jpeg"]);
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
  expect(await termsWithoutTooltips(page)).toEqual([]);
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
  await overrideProgramData(page, cancelledAfterOneTurn);
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
  expect(await termsWithoutTooltips(page)).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  const programSummary = page.getByTestId("program-summary");
  await expect(programSummary).toContainText(
    "below the Cancellation Level of 90",
  );
  expect(await termsWithoutTooltips(page)).toEqual([]);
});

test("shows why a plan the player can't afford is rejected", async ({
  page,
}) => {
  await overrideProgramData(page, { startingMoneyMillions: 500 });
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText("costs $1B");
  await expect(page.getByRole("alert")).toContainText("$500M");
  expect(await termsWithoutTooltips(page)).toEqual([]);
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
