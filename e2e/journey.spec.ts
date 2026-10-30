import { expect, test, type Page } from "@playwright/test";

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

test("plays from a new Program through a launch to the next Turn", async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.goto("/");

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
    await screen.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByTestId("journey-progress")).toHaveText(
    /Pathfinder Orbiter: arrived at Mars/,
  );
  await expect(page.getByTestId("operating-at-mars")).toHaveText(
    "Pathfinder Orbiter",
  );

  const summary = page.getByTestId("turn-summary");
  await expect(summary).toContainText("First orbiter at Mars");
  await expect(summary).toContainText("100 Science");
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
  expect(problems).toEqual([]);
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
