import { expect, test } from "@playwright/test";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { openBusyProgram } from "./busyProgram";
import { chooseAssets } from "./helpers";
import { screenSizes, whatScrolls } from "./layoutHelpers";

const realFiles = realCatalogueFiles();

for (const size of screenSizes) {
  const sizeName = `${size.width}×${size.height}`;

  test.describe(`at ${sizeName}`, () => {
    test.use({ viewport: size });

    test("Planning Mode fits on one screen with Crew at Mars, and a Crewed Mission with everything else chosen", async ({
      page,
    }) => {
      await openBusyProgram(page, { crewAtMars: true });
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-colossus");
      await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
      // The smallest Crew, which leaves room for a lander, Supplies, Contingencies and a Free-return, so that a landing
      // is planned as well.
      await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
      await page
        .getByRole("combobox", { name: "Protection" })
        .selectOption("protection-light-shielding");
      await chooseAssets(page, ["Prospector Lander"]);
      for (const contingency of await page
        .getByRole("checkbox", { name: /Contingency/ })
        .all()) {
        await contingency.check();
      }
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByTestId("crew-joining")).toBeVisible();
      await expect(page.getByTestId("crew-at-mars")).toContainText(
        realFiles.crew.names[3] ?? "",
      );
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with Crew at Mars, and a Crewed Mission that lands with everything else chosen", async ({
      page,
    }) => {
      await openBusyProgram(page, { crewAtMars: true });
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-colossus");
      await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
      // The smallest Crew, which leaves room for a lander, Supplies, Contingencies and a Free-return.
      await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
      // Landing, they can't join the Crew in Mars orbit, so they choose an Activity of their own, which is the widest row.
      await page
        .getByRole("combobox", { name: "Crew destination" })
        .selectOption("landingSite");
      await page
        .getByRole("combobox", { name: "Protection" })
        .selectOption("protection-light-shielding");
      await chooseAssets(page, ["Prospector Lander"]);
      for (const contingency of await page
        .getByRole("checkbox", { name: /Contingency/ })
        .all()) {
        await contingency.check();
      }
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(
        page.getByRole("combobox", {
          name: "Activity for the Crew",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with round-trip Crew to bring home, samples waiting, and a round trip with every Contingency", async ({
      page,
    }) => {
      await openBusyProgram(page, { crewAtMars: true, samplesWaiting: true });
      await expect(page.getByTestId("samples-waiting")).toContainText(
        "Samples at Jezero Crater: 18",
      );
      await page.getByRole("checkbox", { name: /^Bring .* home$/ }).check();
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-colossus");
      await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
      await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
      await page
        .getByRole("combobox", { name: "Protection" })
        .selectOption("protection-light-shielding");
      await page.getByRole("checkbox", { name: "Round trip" }).check();
      // The journey home's Mission Events are listed too, each with its Contingency.
      await expect(
        page.getByTestId("homeward-events").getByTestId("mission-event"),
      ).toHaveCount(2);
      for (const contingency of await page
        .getByRole("checkbox", { name: /Contingency/ })
        .all()) {
        await contingency.check();
      }
      await page
        .getByRole("combobox", { name: "Trajectory" })
        .selectOption("free-return");
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });

    test("Planning Mode fits on one screen with one-way Crew to fetch, and a Crewed Mission that swaps Crew with a return vehicle", async ({
      page,
    }) => {
      await openBusyProgram(page, { crewAtMars: true, oneWayCrew: true });
      await page.getByRole("checkbox", { name: /^Bring .* home$/ }).check();
      await page
        .getByRole("combobox", { name: "Launch Vehicle" })
        .selectOption("meridian-colossus");
      await page.getByRole("checkbox", { name: /Crewed Mission/ }).check();
      await page.getByRole("combobox", { name: "Crew size" }).selectOption("2");
      // Landing, they choose an Activity of their own, which is the widest row.
      await page
        .getByRole("combobox", { name: "Crew destination" })
        .selectOption("landingSite");
      await page
        .getByRole("combobox", { name: "Protection" })
        .selectOption("protection-light-shielding");
      await page.getByRole("checkbox", { name: /Return vehicle/ }).check();
      await expect(
        page.getByRole("combobox", { name: "Crew to fetch" }),
      ).toContainText(realFiles.crew.names[4] ?? "");
      // The journey home of the one-way Crew it fetches from Mars orbit, beside the round-trip Crew there.
      await expect(
        page.getByTestId("homeward-events").getByTestId("mission-event"),
      ).toHaveCount(2);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByTestId("landing-site-details")).toBeVisible();
      expect(await whatScrolls(page)).toEqual([]);
      for (const name of ["Launch Mission", "End Turn without launching"]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
          ratio: 1,
        });
      }
    });
  });
}
