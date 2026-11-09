import type { AssetAtMars, Timeline } from "../simulation/simulation";
import { journeyProgress } from "./solarSystem/orbits";

type Mission = NonNullable<Timeline["mission"]>;

function describeAsset(
  asset: Mission["assets"][number],
  day: number,
  returnsToEarth: Mission["returnsToEarth"],
): string | null {
  if (asset.lostOnDay !== null && day >= asset.lostOnDay) {
    if (returnsToEarth) {
      return day >= returnsToEarth.backOnDay
        ? `${asset.name}: back at Earth`
        : `${asset.name}: heading back to Earth`;
    }
    return asset.crashed
      ? `${asset.name}: crashed at ${asset.landingSiteName ?? "Mars"}`
      : `${asset.name}: lost, and will not reach Mars`;
  }
  if (asset.deliveredOnDay !== null && day >= asset.deliveredOnDay) {
    return asset.landingSiteName
      ? `${asset.name}: landed at ${asset.landingSiteName}`
      : `${asset.name}: arrived at Mars`;
  }
  return null;
}

/**
 * What the player reads about the Turn's Mission on a given day, or null when there's nothing to add to the rest of the
 * box. It names each Asset once: one that has arrived and is operating is left to the list of what's operating at Mars,
 * and one landing at the Landing Site the surface view shows is left to that site's own list. How far there is to go
 * is left to the Turn's progress bar.
 */
export function describeJourney(
  timeline: Pick<Timeline, "mission" | "assetsAtMars">,
  day: number,
  shownSite: string | null = null,
): string | null {
  const { mission } = timeline;
  if (!mission) return "No Mission this Turn";
  const operating = assetsAtMarsOn(timeline, day);
  // The Asset this Mission delivered, operating from the day it arrived.
  const isOperating = ({ name, deliveredOnDay }: Mission["assets"][number]) =>
    operating.some(
      (there) => there.name === name && there.arrivedOnDay === deliveredOnDay,
    );
  const settled = mission.assets.flatMap((asset) => {
    if (asset.lostOnDay === null && isOperating(asset)) return [];
    const text = describeAsset(asset, day, mission.returnsToEarth);
    return text === null ? [] : [text];
  });
  const stillGoing = mission.assets
    .filter(
      (asset) =>
        describeAsset(asset, day, mission.returnsToEarth) === null &&
        (shownSite === null || asset.landingSiteName !== shownSite),
    )
    .map((asset) => asset.name);
  if (stillGoing.length > 0) {
    settled.push(
      `${stillGoing.join(", ")}: ${journeyProgress(mission, day) < 1 ? "on its way to Mars" : "arriving at Mars"}`,
    );
  }
  return settled.length > 0 ? settled.join(". ") : null;
}

/** The Assets operating at Mars on a given day. */
export function assetsAtMarsOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): AssetAtMars[] {
  return timeline.assetsAtMars.filter(
    ({ fromDay, untilDay }) =>
      day >= fromDay && (untilDay === null || day < untilDay),
  );
}

/**
 * What the "Operating at Mars" list shows on a given day, leaving out the Assets at the Landing Site the surface view
 * shows, which that site's own list names.
 */
export function assetsOperatingOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
  shownSite: string | null = null,
): string[] {
  return assetsAtMarsOn(timeline, day)
    .filter(
      ({ landingSiteName }) =>
        shownSite === null || landingSiteName !== shownSite,
    )
    .map(
      (asset) =>
        `${
          asset.landingSiteName
            ? `${asset.label} at ${asset.landingSiteName}`
            : asset.label
        }: ${asset.activityName}${
          asset.cutServiceLifeDays === undefined
            ? ""
            : `, Service Life cut to ${asset.cutServiceLifeDays} days`
        }`,
    );
}
