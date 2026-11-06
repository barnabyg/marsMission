import { z } from "zod";

/* The fields that more than one data file's schema shares. */

export const id = z.string().min(1);
export const money = z.number().int().nonnegative();

export const isoDate = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(value)
  );
}, "must be a real date written as YYYY-MM-DD");

/** How mature an Asset or Launch Vehicle is when a Program starts, and what it costs and risks until it is Flight-proven. */
export const technologyFields = {
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
