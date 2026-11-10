import { z } from "zod";
import { isoDate, type Catalogue } from "../catalogue/catalogue";
import { newRecord } from "./programSummary";
import {
  corruptSave,
  restoreThroughFormats,
  SaveError,
  type SaveFormat,
} from "./restoreSave";
import type { Program } from "./types";

/** A Program as data, for keeping between sessions. */
export interface SavedProgram {
  formatVersion: number;
  program: Program;
}

const count = z.number().int().nonnegative();

const programStatus = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("active") }),
  z.strictObject({ kind: z.literal("retired") }),
  z.strictObject({ kind: z.literal("cancelled"), reason: z.string() }),
]);

const format1 = z.strictObject({
  seed: z.number().int(),
  turnNumber: z.number().int().positive(),
  date: isoDate,
  moneyMillions: count,
  publicSupport: count,
  science: count,
  milestoneIds: z.array(z.string()),
  fundingThresholdsPaid: z.array(count),
  operatingAssets: z.array(
    z.strictObject({
      assetId: z.string(),
      name: z.string(),
      kind: z.string(),
      arrivedOn: isoDate,
    }),
  ),
  status: programStatus,
});

/** Adds the sites landed at and where each Asset is. Everything saved before this was in orbit. */
const format2 = format1.extend({
  landedSiteIds: z.array(z.string()),
  operatingAssets: z.array(
    z.strictObject({
      ...format1.shape.operatingAssets.element.shape,
      landingSiteId: z.string().nullable(),
    }),
  ),
});

/** Adds Survey progress. A save from before Surveys has only the sites known from the start, none of them surveyed. */
const format3 = format2.extend({
  knownLandingSiteIds: z.array(z.string()),
  surveyedLandingSiteIds: z.array(z.string()),
});

/** Adds each Asset's Service Life. A save from before Service Life gets the shortest option for its kind, counted from its arrival. */
const format4 = format3.extend({
  operatingAssets: z.array(
    z.strictObject({
      ...format2.shape.operatingAssets.element.shape,
      serviceLifeDays: z.number().int().positive(),
    }),
  ),
});

function shortestServiceLife(
  { assetId, kind }: { assetId: string; kind: string },
  { assets }: Catalogue,
): number {
  const asset =
    assets.find(({ id }) => id === assetId) ??
    assets.find((candidate) => candidate.kind === kind);
  const shortest = asset?.serviceLifeOptions[0];
  if (!shortest) throw new SaveError(corruptSave);
  return shortest.days;
}

/** Adds each Asset's Reliability. A save from before it gets the cheapest level. */
const format5 = format4.extend({
  operatingAssets: z.array(
    z.strictObject({
      ...format4.shape.operatingAssets.element.shape,
      reliabilityLevelId: z.string(),
    }),
  ),
});

/** Adds each Asset's Activity. A save from before it gets Survey if the Asset can survey, which it was already doing, and otherwise Nothing. */
const format6 = format5.extend({
  operatingAssets: z.array(
    z.strictObject({
      ...format5.shape.operatingAssets.element.shape,
      activityId: z.string(),
    }),
  ),
});

function activityBeforeActivities(
  { assetId, kind }: { assetId: string; kind: string },
  { assets, activities }: Catalogue,
): string {
  const asset =
    assets.find(({ id }) => id === assetId) ??
    assets.find((candidate) => candidate.kind === kind);
  const listed = (asset?.activities ?? []).flatMap((id) =>
    activities.filter((activity) => activity.id === id),
  );
  const activity =
    listed.find(({ effect }) => effect.kind === "survey") ??
    listed.find(({ effect }) => effect.kind === "nothing") ??
    activities.find(({ effect }) => effect.kind === "nothing");
  if (!activity) throw new SaveError(corruptSave);
  return activity.id;
}

/** Adds Technology Readiness and Development: the technologies the Program has made Flight-proven, whether each Asset flew unproven, and the Developments started. Everything a save from before it holds started Flight-proven, and it has started no Development. */
const format7 = format6.extend({
  provenTechnologyIds: z.array(z.string()),
  developments: z.array(
    z.strictObject({
      technologyId: z.string(),
      finishesOnTurn: z.number().int().positive(),
    }),
  ),
  operatingAssets: z.array(
    z.strictObject({
      ...format6.shape.operatingAssets.element.shape,
      flewUnproven: z.boolean(),
    }),
  ),
});

const crewLossCause = z.enum([
  "missionEvent",
  "solarParticleEvent",
  "health",
  "supplies",
]);

/**
 * Adds Crew: every Crew member who has flown, where they are (Mars orbit, a Landing Site, lost or home) and the
 * Protection their Mission carried, with what the Crew in each place do and the Supplies, in kilograms, they have left.
 * A save from before Crew has none.
 */
const format8 = format7.extend({
  crew: z.array(
    z.strictObject({
      name: z.string(),
      health: z.number().nonnegative(),
      arrivedOn: isoDate.nullable(),
      location: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("marsOrbit") }),
        z.strictObject({
          kind: z.literal("landingSite"),
          landingSiteId: z.string(),
        }),
        z.strictObject({
          kind: z.literal("lost"),
          lostOn: isoDate,
          cause: crewLossCause,
        }),
        z.strictObject({ kind: z.literal("home"), backOn: isoDate }),
      ]),
      protectionId: z.string(),
    }),
  ),
  crewActivities: z.record(z.string(), z.string()),
  crewSupplies: z.record(z.string(), z.number().nonnegative()),
});

/**
 * Adds round trips: the Earth return stages in Mars orbit, each with the Crew it waits to bring home and the
 * Reliability and Contingencies bought for their journey. A save from before them has none, so every Crew member at
 * Mars in it went one way.
 */
const format9 = format8.extend({
  earthReturnStages: z.array(
    z.strictObject({
      arrivedOn: isoDate,
      crew: z.array(z.string()),
      reliability: z.record(z.string(), z.string()),
      contingencyIds: z.array(z.string()),
    }),
  ),
});

/**
 * Adds ascent propellant: what fuel plants have made at each Landing Site, in kilograms, by the site's id. A save from
 * before fuel plants has none anywhere.
 */
const format10 = format9.extend({
  ascentPropellantKg: z.record(z.string(), count),
});

/**
 * Adds the Supplies held in habitats, in kilograms, by the Landing Site's id. A save from before habitats has none
 * anywhere.
 */
const format11 = format10.extend({
  habitatSuppliesKg: z.record(z.string(), z.number().nonnegative()),
});

const homewardPurchase = z.strictObject({
  reliability: z.record(z.string(), z.string()),
  contingencyIds: z.array(z.string()),
});

/**
 * Adds samples: those cached at each Landing Site, by the site's id, and what the Missions of ascent vehicles and Earth
 * return orbiters bought for the samples' journey home, on each of them. A save from before samples has none anywhere,
 * and none of its Assets has bought anything for a journey home.
 */
const format12 = format11.extend({
  samplesAtSites: z.record(z.string(), count),
  operatingAssets: z.array(
    z.strictObject({
      ...format7.shape.operatingAssets.element.shape,
      homeward: homewardPurchase.optional(),
    }),
  ),
});

/**
 * Adds Tutorial mode: off, on, or ended for good, at its goal or once it couldn't recover. A save from before it has
 * it off.
 */
const format13 = format12.extend({
  tutorial: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("off") }),
    z.strictObject({ kind: z.literal("on") }),
    z.strictObject({
      kind: z.literal("ended"),
      outcome: z.enum(["goalReached", "cantRecover"]),
    }),
  ]),
});

/**
 * Adds the record kept for the Program summary: the Missions launched and lost, the highest Public Support, the samples
 * home and the Turn each Milestone was earned. A save from before it counts from the Turn it is on, with its Public
 * Support then as the highest.
 */
const format14 = format13.extend({
  record: z.strictObject({
    countedFromTurn: z.number().int().positive(),
    missionsLaunched: count,
    missionsLost: count,
    peakPublicSupport: count,
    samplesHome: count,
    milestoneTurns: z.record(z.string(), z.number().int().positive()),
  }),
});

/**
 * Adds the Bailout: available, offered for the Turn just played, or taken with the repayments still to come. Repaying
 * it can take Money below zero. A save from before it has it available.
 */
const format15 = format14.extend({
  moneyMillions: z.number().int(),
  bailout: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("available") }),
    z.strictObject({ kind: z.literal("offered"), millions: count }),
    z.strictObject({
      kind: z.literal("taken"),
      onTurn: z.number().int().positive(),
      millions: count,
      repaymentsMillions: z.array(count),
    }),
  ]),
});

const newestFormat = format15;

/** Every format so far, oldest first. A format's version is its position in this list, counting from 1. */
const formats: readonly SaveFormat[] = [
  {
    schema: format1,
    upgrade: (old: z.output<typeof format1>): z.output<typeof format2> => ({
      ...old,
      landedSiteIds: [],
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        landingSiteId: null,
      })),
    }),
  },
  {
    schema: format2,
    upgrade: (
      old: z.output<typeof format2>,
      { landingSites }: Catalogue,
    ): z.output<typeof format3> => ({
      ...old,
      knownLandingSiteIds: landingSites
        .filter((site) => site.knownFromStart)
        .map((site) => site.id),
      surveyedLandingSiteIds: [],
    }),
  },
  {
    schema: format3,
    upgrade: (
      old: z.output<typeof format3>,
      catalogue: Catalogue,
    ): z.output<typeof format4> => ({
      ...old,
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        serviceLifeDays: shortestServiceLife(asset, catalogue),
      })),
    }),
  },
  {
    schema: format4,
    upgrade: (
      old: z.output<typeof format4>,
      { reliabilityLevels }: Catalogue,
    ): z.output<typeof format5> => {
      const cheapest = reliabilityLevels[0];
      if (!cheapest) throw new SaveError(corruptSave);
      return {
        ...old,
        operatingAssets: old.operatingAssets.map((asset) => ({
          ...asset,
          reliabilityLevelId: cheapest.id,
        })),
      };
    },
  },
  {
    schema: format5,
    upgrade: (
      old: z.output<typeof format5>,
      catalogue: Catalogue,
    ): z.output<typeof format6> => ({
      ...old,
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        activityId: activityBeforeActivities(asset, catalogue),
      })),
    }),
  },
  {
    schema: format6,
    upgrade: (old: z.output<typeof format6>): z.output<typeof format7> => ({
      ...old,
      provenTechnologyIds: [],
      developments: [],
      operatingAssets: old.operatingAssets.map((asset) => ({
        ...asset,
        flewUnproven: false,
      })),
    }),
  },
  {
    schema: format7,
    upgrade: (old: z.output<typeof format7>): z.output<typeof format8> => ({
      ...old,
      crew: [],
      crewActivities: {},
      crewSupplies: {},
    }),
  },
  {
    schema: format8,
    upgrade: (old: z.output<typeof format8>): z.output<typeof format9> => ({
      ...old,
      earthReturnStages: [],
    }),
  },
  {
    schema: format9,
    upgrade: (old: z.output<typeof format9>): z.output<typeof format10> => ({
      ...old,
      ascentPropellantKg: {},
    }),
  },
  {
    schema: format10,
    upgrade: (old: z.output<typeof format10>): z.output<typeof format11> => ({
      ...old,
      habitatSuppliesKg: {},
    }),
  },
  {
    schema: format11,
    upgrade: (old: z.output<typeof format11>): z.output<typeof format12> => ({
      ...old,
      samplesAtSites: {},
    }),
  },
  {
    schema: format12,
    upgrade: (old: z.output<typeof format12>): z.output<typeof format13> => ({
      ...old,
      tutorial: { kind: "off" },
    }),
  },
  {
    schema: format13,
    upgrade: (old: z.output<typeof format13>): z.output<typeof format14> => ({
      ...old,
      record: newRecord(old.turnNumber, old.publicSupport),
    }),
  },
  {
    schema: format14,
    upgrade: (old: z.output<typeof format14>): z.output<typeof format15> => ({
      ...old,
      bailout: { kind: "available" },
    }),
  },
  { schema: newestFormat },
];

export function saveProgram(program: Program): SavedProgram {
  return { formatVersion: formats.length, program };
}

export function restoreProgram(saved: unknown, catalogue: Catalogue): Program {
  const restored = newestFormat.safeParse(
    restoreThroughFormats(saved, catalogue, formats),
  );
  if (!restored.success) throw new SaveError(corruptSave);
  const program: Program = restored.data;
  if (program.status.kind !== "active") {
    throw new SaveError("This Program has ended, so it can't be continued.");
  }
  return program;
}
