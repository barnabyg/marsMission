import { z } from "zod";
import {
  activitiesSchema,
  assetsSchema,
  launchVehiclesSchema,
  researchKindsSchema,
} from "./assetSchemas";
import { crewSchema } from "./crewSchema";
import { id, isoDate, money } from "./schemaFields";

export { isoDate } from "./schemaFields";

/*
 * What each data file must look like, one file at a time, with Launch Vehicles, Assets and their Activities in
 * assetSchemas.ts and the Crewed Mission in crewSchema.ts. The crossCheck files check them against each other.
 */

const programSchema = z.strictObject({
  firstLaunchWindow: isoDate,
  launchWindowIntervalDays: z.number().int().positive(),
  startingMoneyMillions: money,
  startingPublicSupport: z.number().int().nonnegative(),
  // At least 1%, and a level of at least 1, so a Program that only skips Turns is always cancelled.
  publicSupportDrainPercent: z.number().int().min(1).max(100),
  cancellationLevel: z.number().int().min(1),
  // The Science each sample earns on the day it reaches Earth, brought home by Crew or by an Earth return orbiter.
  sciencePerSampleHome: z.number().int().nonnegative(),
  // Base funding: paid as each Turn ends, while the Program is active, for each point of Public Support it had as the
  // Turn started, up to a most for a Turn. Left out, there is none.
  baseFunding: z
    .strictObject({
      millionsPerPublicSupport: z.number().nonnegative(),
      mostMillions: money,
    })
    .optional(),
  // The Bailout: once in a Program, the cost of a lost Mission refunded, repaid in equal instalments as each of this
  // many Turns ends. Left out, there is none.
  bailout: z
    .strictObject({
      repaymentTurns: z.number().int().positive(),
    })
    .optional(),
});

const trajectoriesSchema = z
  .array(
    z.strictObject({
      id,
      name: z.string().min(1),
      description: z.string().min(1),
      // How long the Mission takes to reach Mars, which is its Duration so far.
      transferDays: z.number().int().positive(),
      costMillions: money,
      // How much less its Launch Vehicle can carry on this Trajectory, because of the extra fuel.
      capacityLossTonnes: z.number().nonnegative(),
      // Brings the Mission home if this Mission Event fails, which only a Mission that goes through it can use.
      freeReturn: z
        .strictObject({
          arrivalBurn: id,
          // The share of what the Assets on board cost that comes back.
          refundPercent: z.number().int().min(0).max(100),
          // How long after the failed burn the Mission is back at Earth.
          returnDays: z.number().int().positive(),
          // Used in place of the Mission Event's failureDescription.
          description: z.string().min(1),
        })
        .optional(),
    }),
  )
  .min(1);

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
    // Departure is when the Mission leaves Earth orbit for Mars: the day after the last of its Mission Events timed from
    // launch, so a Mission with more to do in Earth orbit, such as orbital refuelling, leaves later. Leaving Mars is when
    // a journey home sets off, on a Turn after the one its Crew arrived in, so only a journey home has those.
    timing: z.strictObject({
      from: z.enum(["launch", "departure", "arrival", "leavingMars"]),
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

const contingenciesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    // The one Mission Event it can rescue.
    missionEvent: id,
    costMillions: money,
    massTonnes: z.number().nonnegative(),
    // The chance that the second roll fails as well.
    rescueFailureProbability: z.number().min(0).max(1),
    // How much shorter a rescued Asset's Service Life is.
    serviceLifeLossPercent: z.number().int().min(0).max(99),
    // Lost on top of the Mission Event's own loss if it's used and the second roll fails.
    extraPublicSupportLoss: z.number().int().nonnegative(),
    // In either description, {site} and {lander} work as they do in a Mission Event's.
    troubleDescription: z.string().min(1),
    rescueDescription: z.string().min(1),
  }),
);

const hazardsSchema = z.strictObject({
  dustStorm: z.strictObject({
    name: z.string().min(1),
    // The chance of one over each Landing Site in each Turn.
    chancePerSitePerTurn: z.number().min(0).max(1),
    // How long one lasts, somewhere from the first to the second.
    minDays: z.number().int().positive(),
    maxDays: z.number().int().positive(),
    // The chance that each Asset carrying on through one fails.
    failureChance: z.number().min(0).max(1),
    // A landing during one over its Landing Site: what its risk is multiplied by if it goes ahead, and the days of
    // Service Life each Asset being landed loses for each day it's held off instead.
    landingRiskMultiplier: z.number().min(1),
    serviceLifeLostPerDayHeld: z.number().positive(),
    // {site} stands for the Landing Site and {days} for how long it lasts.
    description: z.string().min(1),
  }),
  solarParticleEvent: z.strictObject({
    name: z.string().min(1),
    // The chance of one on each day a Mission is on its way to Mars, so a longer Duration is more exposed.
    chancePerDayInFlight: z.number().min(0).max(1),
    // How much shorter the Service Life of each Asset on board is in safe mode.
    safeModeServiceLifeLossPercent: z.number().int().min(0).max(99),
    // Carrying on: the chance of damage, how much Service Life it costs, and the chance that damage loses them all.
    damageChance: z.number().min(0).max(1),
    damageServiceLifeLossPercent: z.number().int().min(0).max(99),
    lossChanceIfDamaged: z.number().min(0).max(1),
    // Lost if it loses the Mission, as a failed Mission Event's is.
    publicSupportLoss: z.number().int().nonnegative(),
    description: z.string().min(1),
  }),
});

const milestonesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    description: z.string().min(1),
    // Earned by the first Asset of a kind to be delivered, the first Asset to land, the first Crew to arrive, the
    // first Crew to land, the first Crew to come home safe, the first samples to reach Earth, or reaching a total of
    // Science.
    trigger: z.union(
      [
        z.strictObject({ assetKindArrives: id }),
        z.strictObject({ assetLands: z.literal(true) }),
        z.strictObject({ crewArrives: z.literal(true) }),
        z.strictObject({ crewLands: z.literal(true) }),
        z.strictObject({ crewComesHome: z.literal(true) }),
        z.strictObject({ samplesComeHome: z.literal(true) }),
        z.strictObject({ totalScience: z.number().int().positive() }),
      ],
      {
        error:
          "must be one of assetKindArrives with a kind of Asset, assetLands with true, crewArrives with true, crewLands with true, crewComesHome with true, samplesComeHome with true, or totalScience with a positive whole number",
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
  trajectories: trajectoriesSchema,
  assets: assetsSchema,
  crew: crewSchema,
  landingSites: landingSitesSchema,
  missionEvents: missionEventsSchema,
  contingencies: contingenciesSchema,
  hazards: hazardsSchema,
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
  trajectories: "trajectories.json",
  assets: "assets.json",
  crew: "crew.json",
  landingSites: "landing-sites.json",
  missionEvents: "mission-events.json",
  contingencies: "contingencies.json",
  hazards: "hazards.json",
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
  /** The first is what a Mission takes unless the player picks another. */
  trajectories: z.output<typeof trajectoriesSchema>;
  assets: z.output<typeof assetsSchema>;
  /** The Crewed Mission: what carries Crew, the Crew sizes on offer, their Health, Activities and names. */
  crew: z.output<typeof crewSchema>;
  /** In the order a Survey reveals them. */
  landingSites: z.output<typeof landingSitesSchema>;
  missionEvents: z.output<typeof missionEventsSchema>;
  contingencies: z.output<typeof contingenciesSchema>;
  hazards: z.output<typeof hazardsSchema>;
  milestones: z.output<typeof milestonesSchema>;
  fundingThresholds: z.output<typeof fundingThresholdsSchema>;
  /** In order, cheapest first. */
  reliabilityLevels: z.output<typeof reliabilityLevelsSchema>;
  riskBands: z.output<typeof riskBandsSchema>;
}
