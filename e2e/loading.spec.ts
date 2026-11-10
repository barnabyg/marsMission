import { expect, test } from "@playwright/test";
import { productionBaseURL } from "../playwright.config";
import { chooseAssets, eventEntries, watchForProblems } from "./helpers";
import { seedFailingAt, successSeed } from "./seeds";

// Loading the game: from the production build the playtest command runs, and refusing data files that don't validate.

test("uses a known seed in a production build, as the playtest command runs it", async ({
  page,
}) => {
  await page.goto(`${productionBaseURL}/?seed=${seedFailingAt("Launch")}`);
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(eventEntries(page).first().getByRole("heading")).toHaveText(
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
  await chooseAssets(page, ["Pathfinder Orbiter"]);
  await page.getByRole("button", { name: "Launch Mission" }).click();
  await expect(
    page.getByTestId("mission-scene").locator("canvas"),
  ).toBeVisible();
  // For a missing file, vite preview sends the game's page with status 200, and the browser reports no problem, so each
  // must come back as an image: Mars and Earth for the scene, and the Asset cards' pictures in Planning Mode. The
  // scene asks for its art only once its lazily loaded chunk has run, which on a busy machine can be after the network
  // has been idle for a while, so this waits for both to arrive rather than for the network to settle.
  await expect
    .poll(() => artTypes.filter((type) => type === "image/jpeg").length)
    .toBe(2);
  // A failed file is only reported once its request ends, which can be after the canvas appears.
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
  expect(
    artTypes.filter((type) => type === "image/png").length,
  ).toBeGreaterThan(0);
  expect(artTypes.filter((type) => !type?.startsWith("image/"))).toEqual([]);
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
