import { z } from "zod";

/* What each data file must look like, one file at a time. catalogue.ts checks them against each other. */

const id = z.string().min(1);
const money = z.number().int().nonnegative();

export const isoDate = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(value)
  );
}, "must be a real date written as YYYY-MM-DD");

const programSchema = z.strictObject({
  firstLaunchWindow: isoDate,
  launchWindowIntervalDays: z.number().int().positive(),
  startingMoneyMillions: money,
  startingPublicSupport: z.number().int().nonnegative(),
  transferDays: z.number().int().positive(),
  // At least 1%, and a level of at least 1, so a Program that only skips Turns is always cancelled.
  publicSupportDrainPercent: z.number().int().min(1).max(100),
  cancellationLevel: z.number().int().min(1),
});

const launchVehiclesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    costMillions: money,
    capacityTonnes: z.number().positive(),
    missionEvents: z.array(id),
  }),
);

const activitiesSchema = z
  .array(
    z.strictObject({
      id,
      name: z.string().min(1),
      description: z.string().min(1),
      // What an Asset doing this Activity brings about.
      effect: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("nothing") }),
        z.strictObject({ kind: z.literal("survey") }),
        // For a whole Turn in service. An Asset in service for part of a Turn earns its share.
        z.strictObject({
          kind: z.literal("research"),
          sciencePerTurn: z.number().int().positive(),
          publicSupportPerTurn: z.number().int().nonnegative(),
          researchKind: id,
          // How it looks in the surface view. Standing still is the "nothing" effect.
          surfaceMotion: z.enum(["traverse", "nearby"]),
        }),
      ]),
    }),
  )
  .min(1);

const researchKindsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    // The Research Grant for each point of Science its Ongoing Research earns. Each Asset's grant for a Turn rounds to whole millions.
    grantMillionsPerScience: z.number().nonnegative(),
  }),
);

const assetsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    kind: id,
    costMillions: money,
    massTonnes: z.number().positive(),
    // The chance of failing in each Turn after the one it arrives in, before Reliability.
    failureChancePerTurn: z.number().min(0).max(1),
    // In order, shortest first. Service Life starts when the Asset arrives, and the first option is what's chosen unless the player picks another.
    serviceLifeOptions: z
      .array(
        z.strictObject({
          days: z.number().int().positive(),
          costMillions: money,
        }),
      )
      .min(1),
    missionEvents: z.array(id),
    // The Activities it can do. The first is what it does unless the player picks another.
    activities: z.array(id).min(1),
    // Whether this Asset lands on Mars, so that a Mission carrying it must name a Landing Site.
    landsAtSite: z.boolean().optional(),
  }),
);

const landingSitesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    landingRisk: z.number().min(0).max(1),
    surveyedLandingRisk: z.number().min(0).max(1),
    // Earned by the first successful landing at this site.
    science: z.number().int().nonnegative(),
    knownFromStart: z.boolean(),
    // In degrees, north and east, as the map in public/art/mars.jpg has them.
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
);

const missionEventsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    // In either description, {site} stands for the Mission's Landing Site and {lander}, which starts a sentence, for what is landing there, such as "The rover".
    description: z.string().min(1),
    failureDescription: z.string().min(1),
    timing: z.strictObject({
      from: z.enum(["launch", "arrival"]),
      days: z.number().int().nonnegative(),
    }),
    // "landingSite" means the risk of the Mission's Landing Site.
    failureProbability: z.union([
      z.number().min(0).max(1),
      z.literal("landingSite"),
    ]),
    publicSupportLoss: z.number().int().nonnegative(),
  }),
);

const milestonesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    // Earned by the first Asset of a kind to be delivered, the first Asset to land, or reaching a total of Science.
    trigger: z.union(
      [
        z.strictObject({ assetKindArrives: id }),
        z.strictObject({ assetLands: z.literal(true) }),
        z.strictObject({ totalScience: z.number().int().positive() }),
      ],
      {
        error:
          "must be one of assetKindArrives with a kind of Asset, assetLands with true, or totalScience with a positive whole number",
      },
    ),
    science: z.number().int().nonnegative(),
    publicSupport: z.number().int().nonnegative(),
  }),
);

const fundingThresholdsSchema = z.array(
  z.strictObject({
    publicSupport: z.number().int().positive(),
    payoutMillions: z.number().int().positive(),
  }),
);

const reliabilityLevelsSchema = z
  .array(
    z.strictObject({
      id,
      name: z.string().min(1),
      costMillions: money,
      // What a Mission Event's failure probability is multiplied by at this level.
      failureMultiplier: z.number().min(0).max(1),
    }),
  )
  .min(1);

const riskBandsSchema = z
  .array(
    z.strictObject({
      upTo: z.number().positive().max(1),
      label: z.string().min(1),
    }),
  )
  .min(1);

export const schemas = {
  program: programSchema,
  activities: activitiesSchema,
  researchKinds: researchKindsSchema,
  launchVehicles: launchVehiclesSchema,
  assets: assetsSchema,
  landingSites: landingSitesSchema,
  missionEvents: missionEventsSchema,
  milestones: milestonesSchema,
  fundingThresholds: fundingThresholdsSchema,
  reliabilityLevels: reliabilityLevelsSchema,
  riskBands: riskBandsSchema,
};

/** The data file behind each part of the catalogue, relative to the data folder. */
export const catalogueFileNames = {
  program: "program.json",
  activities: "activities.json",
  researchKinds: "research-kinds.json",
  launchVehicles: "launch-vehicles.json",
  assets: "assets.json",
  landingSites: "landing-sites.json",
  missionEvents: "mission-events.json",
  milestones: "milestones.json",
  fundingThresholds: "funding-thresholds.json",
  reliabilityLevels: "reliability-levels.json",
  riskBands: "risk-bands.json",
} as const satisfies Record<keyof typeof schemas, string>;

export interface Catalogue {
  program: z.output<typeof programSchema>;
  activities: z.output<typeof activitiesSchema>;
  researchKinds: z.output<typeof researchKindsSchema>;
  launchVehicles: z.output<typeof launchVehiclesSchema>;
  assets: z.output<typeof assetsSchema>;
  /** In the order a Survey reveals them. */
  landingSites: z.output<typeof landingSitesSchema>;
  missionEvents: z.output<typeof missionEventsSchema>;
  milestones: z.output<typeof milestonesSchema>;
  fundingThresholds: z.output<typeof fundingThresholdsSchema>;
  /** In order, cheapest first. */
  reliabilityLevels: z.output<typeof reliabilityLevelsSchema>;
  riskBands: z.output<typeof riskBandsSchema>;
}
