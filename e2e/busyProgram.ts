import { expect, type Page } from "@playwright/test";
import { storageKeyFor } from "../src/save/saveStore";
import { realCatalogueFiles } from "../src/testing/realCatalogue";
import { successSeed } from "./seeds";

/** A busy Program for the tests of Planning Mode's layout, opened from a save as a returning player would. */

const realFiles = realCatalogueFiles();
export const realMilestones = realFiles.milestones;
const allLandingSiteIds = realFiles.landingSites.map(({ id }) => id);

/**
 * Opens Planning Mode with every Milestone earned and several operating Assets listed, and if asked,
 * with nothing left to Survey, which adds a note to each panel with an Asset set to Survey, or with Crew at Mars, one-way
 * Crew among them if asked, and samples waiting at Jezero Crater if asked.
 */
export async function openBusyProgram(
  page: Page,
  {
    allSurveyed = false,
    colossusBuilt = false,
    crewAtMars = false,
    oneWayCrew = false,
    samplesWaiting = false,
  } = {},
): Promise<void> {
  const saved = busyProgram(allSurveyed);
  const developed = {
    ...saved.program,
    provenTechnologyIds: [],
    developments: [{ technologyId: "meridian-colossus", finishesOnTurn: 9 }],
    operatingAssets: saved.program.operatingAssets.map((asset) => ({
      ...asset,
      flewUnproven: false,
    })),
  };
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [
      storageKeyFor("automatic"),
      JSON.stringify(
        crewAtMars
          ? {
              // Format 9 holds Crew and their Earth return stages, here with the largest Crew in Mars orbit on a round
              // trip, so that Planning Mode offers to bring them home. Format 12 adds samples waiting at a Landing
              // Site, which Planning Mode offers to send home too.
              formatVersion: samplesWaiting ? 12 : 9,
              program: {
                ...(samplesWaiting
                  ? {
                      ascentPropellantKg: {},
                      habitatSuppliesKg: {},
                      samplesAtSites: { "jezero-crater": 18 },
                    }
                  : {}),
                ...developed,
                // Enough for a large Crewed Mission and a lander, so that nothing shows a problem.
                moneyMillions: 9000,
                crew: [
                  ...realFiles.crew.names.slice(0, 4).map((name) => ({
                    name,
                    health: realFiles.crew.maxHealth,
                    arrivedOn: "2043-07-01",
                    location: { kind: "marsOrbit" },
                    protectionId: realFiles.crew.protection[0]?.id,
                  })),
                  // If asked, one-way Crew who joined them, so that Planning Mode offers a return vehicle for them.
                  ...(oneWayCrew ? realFiles.crew.names.slice(4, 6) : []).map(
                    (name) => ({
                      name,
                      health: realFiles.crew.maxHealth,
                      arrivedOn: "2044-07-01",
                      location: { kind: "marsOrbit" },
                      protectionId: realFiles.crew.protection[0]?.id,
                    }),
                  ),
                ],
                crewActivities: { "mars-orbit": "crew-research" },
                crewSupplies: { "mars-orbit": 3500 },
                earthReturnStages: [
                  {
                    arrivedOn: "2043-07-01",
                    crew: realFiles.crew.names.slice(0, 4),
                    reliability: {},
                    contingencyIds: [],
                  },
                ],
              },
            }
          : colossusBuilt
            ? // Format 7 holds Development, here with the Meridian Colossus built.
              { formatVersion: 7, program: developed }
            : saved,
      ),
    ] as const,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue this Program" }).click();
  await expect(page.getByTestId("turn-number")).toHaveText("9");
}

/** A Program in save format 6 with every Milestone earned and several operating Assets. */
function busyProgram(allSurveyed: boolean) {
  return {
    formatVersion: 6,
    program: {
      seed: successSeed,
      turnNumber: 9,
      date: "2045-01-01",
      // Enough for every Asset that can fly, on the Meridian Colossus, with every Contingency and Development.
      moneyMillions: 20000,
      publicSupport: 200,
      science: 800,
      milestoneIds: realMilestones.map(({ id }) => id),
      landedSiteIds: ["jezero-crater"],
      knownLandingSiteIds: allSurveyed
        ? allLandingSiteIds
        : ["jezero-crater", "gale-crater"],
      surveyedLandingSiteIds: allSurveyed ? allLandingSiteIds : [],
      fundingThresholdsPaid: [250],
      // A lander and a rover at a Landing Site too, whose rows are the longest and whose research lengthens the panel's text.
      operatingAssets: Array.from({ length: 8 }, (_, index) => ({
        ...(index < 6
          ? {
              assetId: "pathfinder-orbiter",
              name: "Pathfinder Orbiter",
              kind: "orbiter",
              landingSiteId: null,
              activityId: "survey",
            }
          : index < 7
            ? {
                assetId: "prospector-lander",
                name: "Prospector Lander",
                kind: "lander",
                landingSiteId: "jezero-crater",
                activityId: "surface-research",
              }
            : {
                assetId: "trailblazer-rover",
                name: "Trailblazer Rover",
                kind: "rover",
                landingSiteId: "jezero-crater",
                activityId: "long-traverse",
              }),
        arrivedOn: `203${index}-08-01`,
        serviceLifeDays: 9000,
        reliabilityLevelId: "none",
      })),
      status: { kind: "active" },
    },
  };
}
