import { z } from "zod";
import { id, money, technologyFields } from "./schemaFields";

/* What the data files of what a Mission can carry must look like: Launch Vehicles, Assets, and the Activities and kinds of research Assets do. */

export const launchVehiclesSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    costMillions: money,
    capacityTonnes: z.number().positive(),
    missionEvents: z.array(id),
    ...technologyFields,
  }),
);

export const activitiesSchema = z
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

export const researchKindsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    // The Research Grant for each point of Science its Ongoing Research earns. Each Asset's grant for a Turn rounds to whole millions.
    grantMillionsPerScience: z.number().nonnegative(),
  }),
);

export const assetsSchema = z.array(
  z.strictObject({
    id,
    name: z.string().min(1),
    kind: id,
    costMillions: money,
    // What it costs for each Turn it is kept operating at Mars after the one it arrives in, until its Service Life
    // ends or the player ends its mission. Left out, it costs nothing.
    upkeepMillionsPerTurn: money.optional(),
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
    // Benefits that raise the same thing don't add up: on each day the largest applies.
    benefit: z
      .discriminatedUnion("raises", [
        // The Ongoing Research of every Asset and Crew on the surface: its Science and Public Support, and so its
        // Research Grant.
        z.strictObject({
          raises: z.literal("surfaceResearch"),
          percent: z.number().int().positive(),
        }),
        // The Research Grant rates of the Ongoing Research at its own Landing Site of the Assets of these kinds, and of
        // the Crew there if `crew` is set. Their Science and Public Support stay as they are.
        z.strictObject({
          raises: z.literal("siteResearchGrants"),
          percent: z.number().int().positive(),
          assetKinds: z.array(id),
          crew: z.boolean(),
        }),
      ])
      .optional(),
    // What it makes at its Landing Site on each day it operates there, whatever its Activity, which builds up there
    // from Turn to Turn and stays if it stops. Each one makes its own, so two at one site make twice as much.
    makes: z
      .strictObject({
        // For Crew leaving the surface, in whole kilograms a day.
        ascentPropellantKgPerDay: z.number().int().positive(),
      })
      .optional(),
    // What it gives the Crew at its Landing Site while it operates there, whatever its Activity: a home that slows the
    // Health they lose to time at Mars by this share, and a store of Supplies that it lands with and holds for them.
    // Habitats at one site don't add up their shares, as on each day the largest applies, but each holds its own Supplies.
    habitat: z
      .strictObject({
        timeAtMarsCutPercent: z.number().int().positive().max(100),
        // In whole kilograms, as it lands full and can be topped up to this.
        suppliesKg: z.number().int().positive(),
      })
      .optional(),
    ...technologyFields,
  }),
);
