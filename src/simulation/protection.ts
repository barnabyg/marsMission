import type { Catalogue } from "../catalogue/catalogue";
import type { PlannedMission } from "./types";

/**
 * Protection, such as radiation shielding: what a Crewed Mission buys to slow the Health its Crew lose to radiation, on
 * the way to Mars, in a solar particle event and at Mars, where it stays with them. Each Crew member keeps the level
 * their Mission carried, so Crew who join others in one place each keep their own. The Catalogue lists the levels
 * from none to the most, each slowing radiation's harm by a larger share, so more Protection is never worse.
 */

type ProtectionLevel = Catalogue["crew"]["protection"][number];

/** The Protection a Mission's Crew carry: the level it chose, or else the first, which gives none. Undefined if the id isn't on offer. */
export function protectionOf(
  catalogue: Catalogue,
  mission: PlannedMission | null,
): ProtectionLevel | undefined {
  const { protection } = catalogue.crew;
  const chosen = mission?.crew?.protectionId;
  return chosen === undefined
    ? protection[0]
    : protection.find(({ id }) => id === chosen);
}

/** The id of the Protection a Mission's Crew carry, which is what their records keep. */
export const protectionIdOf = (
  catalogue: Catalogue,
  mission: PlannedMission | null,
): string =>
  (protectionOf(catalogue, mission) ?? catalogue.crew.protection[0])?.id ?? "";

/** By what share, in percent, a Crew member's Protection slows radiation's harm. A level no longer on offer gives none. */
export const radiationCutOf = (
  catalogue: Catalogue,
  protectionId: string,
): number =>
  catalogue.crew.protection.find(({ id }) => id === protectionId)
    ?.radiationCutPercent ?? 0;

/** Radiation's harm, whether a rate or a blow, slowed by this share. */
export const protectedFrom = (harm: number, cutPercent: number): number =>
  (harm * (100 - cutPercent)) / 100;
