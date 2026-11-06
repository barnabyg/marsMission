import type { Catalogue } from "../catalogue/catalogue";
import type { Rules } from "./rules";

/*
 * What Crew and samples coming home share before they fly: the days a journey home leaves Mars and gets home, and how
 * a plan names a Landing Site's samples to send them home, which `TurnPlan.bringHome` holds in place of an Earth return
 * stage's key (`earthReturnStages.ts`).
 */

const samplesKeyPrefix = "samples:";

/** How a plan names a Landing Site's samples to send them home. */
export const samplesKeyOf = (siteId: string): string =>
  `${samplesKeyPrefix}${siteId}`;

/** Whether a plan's journey home is a Landing Site's samples, rather than Crew. */
export const isSamplesKey = (key: string | undefined): boolean =>
  key?.startsWith(samplesKeyPrefix) === true;

/** The Landing Site whose samples a plan's journey home sends, by id, or null if it sends none. */
export const siteOfSamplesKey = (key: string | undefined): string | null =>
  key !== undefined && isSamplesKey(key)
    ? key.slice(samplesKeyPrefix.length)
    : null;

/** The day of the Turn a journey home leaves Mars, and the day it is home if nothing goes wrong. */
export function journeyHomeDays(
  catalogue: Catalogue,
  rules: Rules,
): { leavesOn: number; homeOn: number } {
  const leavesOn = catalogue.crew.roundTrip.leavesMarsOnDay;
  const last = rules.journeyHomeEvents().at(-1);
  return { leavesOn, homeOn: leavesOn + (last?.timing.days ?? 0) };
}
