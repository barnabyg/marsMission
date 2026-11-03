import { z } from "zod";

/* What each data file must look like, one file at a time. The crossCheck files check them against each other. */

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
  // At least 1%, and a level of at least 1, so a Program that only skips Turns is always cancelled.
  publicSupportDrainPercent: z.number().int().min(1).max(100),
  cancellationLevel: z.number().int().min(1),
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

/** How mature an Asset or Launch Vehicle is when a Program starts, and what it costs and risks until it is Flight-proven. */
const technologyFields = {
  // "built" hasn't flown yet, so it is Flight-proven only after its first successful use. "not-built" can't fly until
  // it has been through Development, and is then built.
  technologyReadiness: z.enum(["flight-proven", "built", "not-built"]),
  // Only for one that doesn't start Flight-proven: its cost in place of costMillions, and what the failure probabilities
  // of the Mission Events it brings and of its failing in service are multiplied by, until it is Flight-proven.
  unproven: z
    .strictObject({
      costMillions: money,
      failureMultiplier: z.number().min(1),
    })
    .optional(),
  // Only for one that isn't built yet: what its Development costs, paid when it starts, and how many Turns it takes.
  development: z
    .strictObject({
      costMillions: money,
      turns: z.number().int().positive(),
    })
    .optional(),
};

const launchVehiclesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    costMillions: money,
    capacityTonnes: z.number().positive(),
    missionEvents: z.array(id),
    ...technologyFields,
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
    // What the landing risk is multiplied by when this Asset lands. A landing is as risky as the riskiest Asset in it.
    landingRiskMultiplier: z.number().positive().optional(),
    // What it raises for other Assets, and by what percentage, on each day it operates at Mars, whatever its Activity.
    // "surfaceResearch" is the Ongoing Research of every Asset and Crew on the surface. Benefits that raise the same
    // thing don't add up: on each day the largest applies.
    benefit: z
      .strictObject({
        raises: z.enum(["surfaceResearch"]),
        percent: z.number().int().positive(),
      })
      .optional(),
    ...technologyFields,
  }),
);

const crewSchema = z.strictObject({
  // The spacecraft that carries the Crew to Mars, and stays with them, in Mars orbit or at their Landing Site.
  vehicleName: z.string().min(1),
  // The Mission Events it brings to Mars orbit, as an Asset's do. The Crew arrive when the last of them succeeds.
  missionEvents: z.array(id).min(1),
  // The Mission Events it brings when the Crew land at a Landing Site instead. They land when the last succeeds.
  landingMissionEvents: z.array(id).min(1),
  // The Crew sizes on offer, smallest first: how many fly, and what the Crewed Mission costs and weighs with them.
  sizes: z
    .array(
      z.strictObject({
        crew: z.number().int().positive(),
        costMillions: money,
        massTonnes: z.number().positive(),
      }),
    )
    .min(1),
  // Each Crew member's Health as they launch, which is the most they can have.
  maxHealth: z.number().int().positive(),
  // How Crew lose Health. Radiation is a cause of its own, on the way to Mars and at Mars, which Protection will slow.
  health: z.strictObject({
    // Health lost to radiation for each day on the way to Mars (or back), and for each day at Mars.
    radiationPerDay: z.strictObject({
      inFlight: z.number().nonnegative(),
      atMars: z.number().nonnegative(),
    }),
    // Health lost for each day at Mars to everything else that living there does to the body.
    timeAtMarsPerDay: z.number().nonnegative(),
    // Health each Crew member on board loses when a Contingency saves their Mission.
    contingencyRescueLoss: z.number().int().nonnegative(),
    // Carrying on through a dust storm at their Landing Site: each Crew member's chance of being hurt, and the Health
    // it costs them if they are.
    dustStorm: z.strictObject({
      chance: z.number().min(0).max(1),
      loss: z.number().int().nonnegative(),
    }),
  }),
  // The Public Support lost for each Crew member lost, whatever the cause, on top of anything else that day costs.
  publicSupportLossPerMember: z.number().int().nonnegative(),
  // What Crew in Mars orbit can do, which all of them there share. The first is what they do unless the player picks
  // another. A research Activity earns its rate for each Crew member doing it.
  orbitActivities: z.array(id).min(1),
  // What Crew at a Landing Site can do, which all of them at that site share, in the same way.
  surfaceActivities: z.array(id).min(1),
  // The names Crew are given, in order. A name is never given twice in a Program.
  names: z.array(z.string().min(1)).min(1),
});

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
    // launch, so a Mission with more to do in Earth orbit, such as orbital refuelling, leaves later.
    timing: z.strictObject({
      from: z.enum(["launch", "departure", "arrival"]),
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
    // first Crew to land, or reaching a total of Science.
    trigger: z.union(
      [
        z.strictObject({ assetKindArrives: id }),
        z.strictObject({ assetLands: z.literal(true) }),
        z.strictObject({ crewArrives: z.literal(true) }),
        z.strictObject({ crewLands: z.literal(true) }),
        z.strictObject({ totalScience: z.number().int().positive() }),
      ],
      {
        error:
          "must be one of assetKindArrives with a kind of Asset, assetLands with true, crewArrives with true, crewLands with true, or totalScience with a positive whole number",
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
